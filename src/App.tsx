import { useCallback, useEffect, useReducer } from 'react'
import { loadSession, saveSession, sessionReducer, tournamentState, view } from './core/session'
import { randomSeed } from './core/rng'
import type { Swipie } from './core/swipie'
import { createRawgSource } from './sources/rawg'
import { offlineSource, type SwipieSource } from './sources/source'
import { ImportPage } from './ui/ImportPage'
import { ResultsPage } from './ui/ResultsPage'
import { SwipePage } from './ui/SwipePage'

const rawgKey = import.meta.env.VITE_RAWG_KEY as string | undefined
const defaultSource = rawgKey ? createRawgSource(rawgKey) : offlineSource

interface Props {
  source?: SwipieSource
  seed?: () => number
}

export function App({ source = defaultSource, seed = randomSeed }: Props) {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () => loadSession(localStorage))
  useEffect(() => saveSession(localStorage, session), [session])

  const byId = useCallback(
    (id: string): Swipie => session.swipies.find((s) => s.id === id) ?? { id, name: id, query: id, status: 'not-found' },
    [session.swipies],
  )
  const state = tournamentState(session)
  const current = view(session)

  return (
    <main className="app">
      <header className="app__header">
        <h1>Swipie</h1>
      </header>
      {current === 'import' && <ImportPage session={session} dispatch={dispatch} source={source} onStart={() => dispatch({ type: 'start', seed: seed() })} />}
      {current === 'swipe' && state && (
        <SwipePage state={state} canUndo={(session.tournament?.picks.length ?? 0) > 0} byId={byId} dispatch={dispatch} />
      )}
      {current === 'results' && state && <ResultsPage state={state} byId={byId} dispatch={dispatch} seed={seed} />}
    </main>
  )
}
