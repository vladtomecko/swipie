import { useCallback, useEffect, useReducer, useRef } from 'react'
import { loadSession, saveSession, sessionReducer, tournamentState, view } from './core/session'
import { randomSeed } from './core/rng'
import { decodeShare, encodeShare, isSameList } from './core/shareLink'
import type { Swipie } from './core/swipie'
import { createRawgSource } from './sources/rawg'
import { offlineSource, type SwipieSource } from './sources/source'
import { ImportPage } from './ui/ImportPage'
import { ResultsPage } from './ui/ResultsPage'
import { RoundSummary } from './ui/RoundSummary'
import { SwipePage } from './ui/SwipePage'
import { useImporter } from './ui/useImporter'

const rawgKey = import.meta.env.VITE_RAWG_KEY as string | undefined
const defaultSource = rawgKey ? createRawgSource(rawgKey) : offlineSource

interface Props {
  source?: SwipieSource
  seed?: () => number
}

export function App({ source = defaultSource, seed = randomSeed }: Props) {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () => loadSession(localStorage))
  useEffect(() => saveSession(localStorage, session), [session])
  const importEntries = useImporter(source, dispatch)

  const sessionRef = useRef(session)
  sessionRef.current = session
  const sharedHandled = useRef(false)
  useEffect(() => {
    if (sharedHandled.current) return
    sharedHandled.current = true
    const shared = decodeShare(window.location.hash)
    if (!shared || isSameList(shared, sessionRef.current)) return
    const { swipies, tournament } = sessionRef.current
    const hasWork = swipies.length > 0 || tournament !== null
    if (hasWork && !window.confirm(`Replace your current list with the ${shared.entries.length} shared games?`)) return
    void importEntries(shared.entries, { algorithm: shared.algorithm })
  }, [importEntries])

  useEffect(() => {
    const { algorithm, swipies } = session
    const hash = swipies.length ? `#${encodeShare({ algorithm, swipies })}` : ''
    if (window.location.hash === hash) return
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  }, [session])

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
      {current === 'import' && <ImportPage session={session} dispatch={dispatch} source={source} onImport={importEntries} onStart={() => dispatch({ type: 'start', seed: seed() })} />}
      {current === 'swipe' && state && (
        <SwipePage state={state} canUndo={(session.tournament?.picks.length ?? 0) > 0} byId={byId} dispatch={dispatch} />
      )}
      {current === 'summary' && state && <RoundSummary state={state} byId={byId} dispatch={dispatch} />}
      {current === 'results' && state && <ResultsPage state={state} byId={byId} dispatch={dispatch} seed={seed} />}
    </main>
  )
}
