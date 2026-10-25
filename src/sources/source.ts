import type { ImportEntry } from '../core/importParser'
import { pendingSwipie, type Swipie } from '../core/swipie'

export interface SwipieSource {
  readonly available: boolean
  search(query: string, signal?: AbortSignal): Promise<Swipie[]>
  resolve(entry: ImportEntry): Promise<Swipie>
}

export const notFound = (entry: ImportEntry): Swipie => ({ ...pendingSwipie({ name: entry.name }), status: 'not-found' })

export const offlineSource: SwipieSource = {
  available: false,
  search: async () => [],
  resolve: async (entry) => notFound(entry),
}
