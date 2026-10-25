import type { ImportEntry } from './importParser'

export interface StoreLink {
  name: string
  url: string
}

export interface Swipie {
  id: string
  name: string
  query: string
  status: 'pending' | 'resolved' | 'not-found'
  rawgId?: number
  image?: string
  rating?: number
  metacritic?: number
  released?: string
  link?: string
  stores?: StoreLink[]
  ratingsCount?: number
  owners?: number
  platforms?: string[]
  tba?: boolean
}

export function pendingSwipie(entry: ImportEntry): Swipie {
  return {
    id: entry.rawgId ? `rawg:${entry.rawgId}` : `q:${entry.name.toLowerCase()}`,
    name: entry.name,
    query: entry.name,
    status: 'pending',
    ...(entry.rawgId ? { rawgId: entry.rawgId } : {}),
  }
}

const byName = (a: Swipie, b: Swipie) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

function isDuplicate(list: readonly Swipie[], s: Swipie) {
  const name = s.name.toLowerCase()
  return list.some((x) => x.id === s.id || x.name.toLowerCase() === name)
}

export function addSwipies(list: readonly Swipie[], incoming: readonly Swipie[]): Swipie[] {
  const out = [...list]
  for (const s of incoming) if (!isDuplicate(out, s)) out.push(s)
  return out.sort(byName)
}

export function removeSwipie(list: readonly Swipie[], id: string): Swipie[] {
  return list.filter((s) => s.id !== id)
}

export function replaceSwipie(list: readonly Swipie[], oldId: string, next: Swipie): Swipie[] {
  if (!list.some((s) => s.id === oldId)) return [...list]
  const rest = removeSwipie(list, oldId)
  return isDuplicate(rest, next) ? rest : [...rest, next].sort(byName)
}
