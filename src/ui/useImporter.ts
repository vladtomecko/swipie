import { useCallback } from 'react'
import type { ImportEntry } from '../core/importParser'
import type { SessionAction } from '../core/session'
import { pendingSwipie } from '../core/swipie'
import type { AlgorithmId } from '../core/tournament'
import type { SwipieSource } from '../sources/source'

const RESOLVE_CONCURRENCY = 4

export function useImporter(source: SwipieSource, dispatch: (a: SessionAction) => void) {
  return useCallback(
    async (entries: ImportEntry[], replaceWith?: { algorithm: AlgorithmId }) => {
      const pending = entries.map(pendingSwipie)
      dispatch(replaceWith ? { type: 'load', algorithm: replaceWith.algorithm, swipies: pending } : { type: 'add', swipies: pending })
      if (!source.available) return
      const queue = entries.map((entry, i) => ({ entry, id: pending[i].id }))
      const worker = async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          dispatch({ type: 'replace', id: job.id, swipie: await source.resolve(job.entry) })
        }
      }
      await Promise.all(Array.from({ length: RESOLVE_CONCURRENCY }, worker))
    },
    [source, dispatch],
  )
}
