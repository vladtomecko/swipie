import type { ImportEntry } from './importParser'
import type { Swipie } from './swipie'
import { ALGORITHMS, type AlgorithmId } from './tournament'

export interface SharedList {
  algorithm: AlgorithmId
  entries: ImportEntry[]
  ranking?: ImportEntry[][]
}

const encodeItem = (s: { name: string; rawgId?: number }) => (s.rawgId ? s.rawgId.toString(36) : `~${encodeURIComponent(s.name)}`)

// Format: s=1&a=<algorithm>&g=<item>,<item>…[&r=<tier>.<tier>…]
// item = base36 RAWG id | ~<uri-encoded name>; tier = <item>+<item>…
export function encodeShare({
  algorithm,
  swipies,
  ranking,
}: {
  algorithm: AlgorithmId
  swipies: readonly Swipie[]
  ranking?: readonly (readonly Swipie[])[]
}): string {
  const base = `s=1&a=${algorithm}&g=${swipies.map(encodeItem).join(',')}`
  return ranking ? `${base}&r=${ranking.map((tier) => tier.map(encodeItem).join('+')).join('.')}` : base
}

function decodeItem(item: string): ImportEntry | null {
  if (item.startsWith('~')) {
    try {
      const name = decodeURIComponent(item.slice(1)).trim()
      return name ? { name } : null
    } catch {
      return null
    }
  }
  if (!/^[0-9a-z]+$/.test(item)) return null
  const rawgId = parseInt(item, 36)
  return rawgId > 0 ? { name: `RAWG #${rawgId}`, rawgId } : null
}

const decodeItems = (text: string, sep: string) =>
  text
    .split(sep)
    .map(decodeItem)
    .filter((e): e is ImportEntry => e !== null)

export function decodeShare(hash: string): SharedList | null {
  const params = new Map(
    hash
      .replace(/^#/, '')
      .split('&')
      .map((kv) => {
        const i = kv.indexOf('=')
        return i < 0 ? [kv, ''] : [kv.slice(0, i), kv.slice(i + 1)]
      }),
  )
  if (params.get('s') !== '1') return null
  const entries = decodeItems(params.get('g') ?? '', ',')
  if (entries.length === 0) return null
  const a = params.get('a') ?? ''
  const algorithm = a in ALGORITHMS ? (a as AlgorithmId) : 'dropout'
  const ranking = (params.get('r') ?? '')
    .split('.')
    .map((tier) => decodeItems(tier, '+'))
    .filter((tier) => tier.length > 0)
  return ranking.length ? { algorithm, entries, ranking } : { algorithm, entries }
}

export const entryKey = (e: { name: string; rawgId?: number }) => (e.rawgId ? `r:${e.rawgId}` : `n:${e.name.toLowerCase()}`)

export function isSameList(shared: SharedList, current: { algorithm: AlgorithmId; swipies: readonly Swipie[] }): boolean {
  if (shared.algorithm !== current.algorithm) return false
  const a = new Set(shared.entries.map(entryKey))
  const b = new Set(current.swipies.map(entryKey))
  return a.size === b.size && [...a].every((k) => b.has(k))
}
