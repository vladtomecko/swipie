import type { ImportEntry } from './importParser'
import type { Swipie } from './swipie'
import { ALGORITHMS, type AlgorithmId } from './tournament'

export interface SharedList {
  algorithm: AlgorithmId
  entries: ImportEntry[]
}

// Format: s=1&a=<algorithm>&g=<item>,<item>…  item = base36 RAWG id | ~<uri-encoded name>
export function encodeShare({ algorithm, swipies }: { algorithm: AlgorithmId; swipies: readonly Swipie[] }): string {
  const items = swipies.map((s) => (s.rawgId ? s.rawgId.toString(36) : `~${encodeURIComponent(s.name)}`))
  return `s=1&a=${algorithm}&g=${items.join(',')}`
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
  const entries = (params.get('g') ?? '')
    .split(',')
    .map(decodeItem)
    .filter((e): e is ImportEntry => e !== null)
  if (entries.length === 0) return null
  const a = params.get('a') ?? ''
  return { algorithm: a in ALGORITHMS ? (a as AlgorithmId) : 'dropout', entries }
}

const entryKey = (e: { name: string; rawgId?: number }) => (e.rawgId ? `r:${e.rawgId}` : `n:${e.name.toLowerCase()}`)

export function isSameList(shared: SharedList, current: { algorithm: AlgorithmId; swipies: readonly Swipie[] }): boolean {
  if (shared.algorithm !== current.algorithm) return false
  const a = new Set(shared.entries.map(entryKey))
  const b = new Set(current.swipies.map(entryKey))
  return a.size === b.size && [...a].every((k) => b.has(k))
}
