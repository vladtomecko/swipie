import type { Swipie } from './swipie'

export const BATCH_LIMIT = 100
export const OBSCURE_BELOW = 10

export interface BatchCandidate {
  swipie: Swipie
  added: boolean
  selected: boolean
}

interface Options {
  query: string
  today: string
  isAdded: (s: Swipie) => boolean
}

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

export function matchesAllWords(title: string, query: string): boolean {
  const wanted = words(query)
  const have = words(title)
  return wanted.length > 0 && wanted.every((w) => have.some((h) => h.startsWith(w)))
}

const isReleased = (s: Swipie, today: string) => !s.tba && !!s.released && s.released <= today

const byRelease = (a: Swipie, b: Swipie) =>
  a.released! < b.released! ? -1 : a.released! > b.released! ? 1 : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

export function batchCandidates(games: readonly Swipie[], { query, today, isAdded }: Options): BatchCandidate[] {
  const seen = new Set<string>()
  const kept: Swipie[] = []
  for (const g of games) {
    const name = g.name.toLowerCase()
    if (seen.has(g.id) || seen.has(name)) continue
    if (!matchesAllWords(g.name, query) || !isReleased(g, today)) continue
    seen.add(g.id).add(name)
    kept.push(g)
  }
  return kept
    .sort(byRelease)
    .slice(0, BATCH_LIMIT)
    .map((swipie) => {
      const added = isAdded(swipie)
      return { swipie, added, selected: !added }
    })
}

export type BatchSort = 'released-asc' | 'released-desc' | 'popular' | 'rating' | 'metacritic'

export const BATCH_SORTS: Record<BatchSort, string> = {
  'released-asc': 'Oldest first',
  'released-desc': 'Newest first',
  popular: 'Most popular',
  rating: 'Best rated',
  metacritic: 'Metacritic',
}

export interface BatchView {
  sort: BatchSort
  yearFrom?: number
  yearTo?: number
  minRatings: number
  platforms: string[]
}

export const DEFAULT_BATCH_VIEW: BatchView = { sort: 'released-asc', minRatings: OBSCURE_BELOW, platforms: [] }

const year = (s: Swipie) => Number(s.released!.slice(0, 4))
const desc = (key: (s: Swipie) => number | undefined) => (a: Swipie, b: Swipie) => (key(b) ?? -Infinity) - (key(a) ?? -Infinity)

const SORTERS: Record<BatchSort, (a: Swipie, b: Swipie) => number> = {
  'released-asc': byRelease,
  'released-desc': (a, b) => byRelease(b, a),
  popular: desc((s) => s.owners ?? s.ratingsCount),
  rating: desc((s) => s.rating),
  metacritic: desc((s) => s.metacritic),
}

export function applyBatchView(candidates: readonly BatchCandidate[], view: BatchView): BatchCandidate[] {
  const sorter = SORTERS[view.sort]
  return candidates
    .filter(({ swipie: s }) => {
      if ((s.ratingsCount ?? 0) < view.minRatings) return false
      if (view.yearFrom !== undefined && year(s) < view.yearFrom) return false
      if (view.yearTo !== undefined && year(s) > view.yearTo) return false
      if (view.platforms.length && !s.platforms?.some((p) => view.platforms.includes(p))) return false
      return true
    })
    .sort((a, b) => sorter(a.swipie, b.swipie) || byRelease(a.swipie, b.swipie))
}

export function platformOptions(candidates: readonly BatchCandidate[]): string[] {
  const counts = new Map<string, number>()
  for (const { swipie } of candidates) for (const p of swipie.platforms ?? []) counts.set(p, (counts.get(p) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p)
}
