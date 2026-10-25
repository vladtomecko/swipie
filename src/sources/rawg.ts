import type { ImportEntry } from '../core/importParser'
import type { StoreLink, Swipie } from '../core/swipie'
import { notFound, type SwipieSource } from './source'

const API = 'https://api.rawg.io/api'

interface RawgGame {
  id: number
  slug: string
  name: string
  released?: string | null
  background_image?: string | null
  rating?: number | null
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

  async function resolve(entry: ImportEntry) {
    try {
      if (entry.rawgId) return toSwipie(await get<RawgGame>(`/games/${entry.rawgId}`, {}), entry.name)
      const [top] = await search(entry.name)
      return top ? { ...top, query: entry.name } : notFound(entry)
    } catch {
      return notFound(entry)
    }
  }

  return { available: true, search, resolve }
}
