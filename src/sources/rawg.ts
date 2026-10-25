import type { ImportEntry } from '../core/importParser'
import type { StoreLink, Swipie } from '../core/swipie'
import { notFound, type SwipieSource } from './source'

const API = 'https://api.rawg.io/api'
const BULK_PAGE_SIZE = 40
const BULK_MAX_PAGES = 3

interface RawgGame {
  id: number
  slug: string
  name: string
  released?: string | null
  background_image?: string | null
  rating?: number | null
  ratings_count?: number | null
  tba?: boolean | null
  metacritic?: number | null
  stores?: { store: { name: string; slug: string } }[] | null
}

const STORE_SEARCH: Record<string, (name: string) => string> = {
  steam: (n) => `https://store.steampowered.com/search/?term=${encodeURIComponent(n)}`,
  gog: (n) => `https://www.gog.com/en/games?query=${encodeURIComponent(n)}`,
  'epic-games': (n) => `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(n)}`,
}

function toSwipie(game: RawgGame, query: string): Swipie {
  const stores: StoreLink[] = (game.stores ?? [])
    .filter((s) => STORE_SEARCH[s.store.slug])
    .map((s) => ({ name: s.store.name, url: STORE_SEARCH[s.store.slug](game.name) }))
  return {
    id: `rawg:${game.id}`,
    rawgId: game.id,
    name: game.name,
    query,
    status: 'resolved',
    link: `https://rawg.io/games/${game.slug}`,
    ...(game.background_image ? { image: game.background_image } : {}),
    ...(game.rating ? { rating: game.rating } : {}),
    ...(game.metacritic ? { metacritic: game.metacritic } : {}),
    ...(game.released ? { released: game.released } : {}),
    ...(stores.length ? { stores } : {}),
    ...(game.ratings_count != null ? { ratingsCount: game.ratings_count } : {}),
    ...(game.tba ? { tba: true } : {}),
  }
}

export function createRawgSource(key: string): SwipieSource {
  async function get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const url = new URL(`${API}${path}`)
    url.search = new URLSearchParams({ key, ...params }).toString()
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`RAWG request failed (${res.status})`)
    return res.json() as Promise<T>
  }

  async function search(query: string, signal?: AbortSignal) {
    const data = await get<{ results: RawgGame[] }>('/games', { search: query, page_size: '8' }, signal)
    return data.results.map((g) => toSwipie(g, query))
  }

  async function searchAll(query: string, signal?: AbortSignal) {
    const out: Swipie[] = []
    for (let page = 1; page <= BULK_MAX_PAGES; page++) {
      const data = await get<{ next?: string | null; results: RawgGame[] }>(
        '/games',
        { search: query, search_precise: 'true', exclude_additions: 'true', page_size: String(BULK_PAGE_SIZE), page: String(page) },
        signal,
      )
      out.push(...data.results.map((g) => toSwipie(g, query)))
      if (!data.next) break
    }
    return out
  }

  async function resolve(entry: ImportEntry) {
    try {
      if (entry.rawgId) {
        const game = await get<RawgGame>(`/games/${entry.rawgId}`, {})
        return toSwipie(game, game.name)
      }
      const [top] = await search(entry.name)
      return top ? { ...top, query: entry.name } : notFound(entry)
    } catch {
      return notFound(entry)
    }
  }

  return { available: true, search, searchAll, resolve }
}
