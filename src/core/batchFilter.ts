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
      return { swipie, added, selected: !added && (swipie.ratingsCount ?? 0) >= OBSCURE_BELOW }
    })
}
