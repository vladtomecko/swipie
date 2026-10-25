import { pendingSwipie } from './swipie'
import { currentMatch, results } from './tournament'
import { initialSession, loadSession, saveSession, sessionReducer, topIds, tournamentState, view, type Session } from './session'

const withGames = (...names: string[]): Session =>
  sessionReducer(initialSession, { type: 'add', swipies: names.map((name) => pendingSwipie({ name })) })

function playToEnd(s: Session): Session {
  let t = tournamentState(s)
  while (t && t.status === 'playing') {
    s = view(s) === 'summary' ? sessionReducer(s, { type: 'continue' }) : sessionReducer(s, { type: 'pick', winner: currentMatch(t)!.a })
    t = tournamentState(s)
  }
  return s
}

test('starts on the import view with dropout selected', () => {
  expect(view(initialSession)).toBe('import')
  expect(initialSession.algorithm).toBe('dropout')
})

test('start is ignored with fewer than two swipies', () => {
  const s = sessionReducer(withGames('A'), { type: 'start', seed: 1 })
  expect(view(s)).toBe('import')
})

test('start -> swipe view, finishing -> results view', () => {
  let s = sessionReducer(withGames('A', 'B', 'C'), { type: 'start', seed: 1 })
  expect(view(s)).toBe('swipe')
  s = playToEnd(s)
  expect(view(s)).toBe('results')
})

test('algorithm choice is used for the tournament', () => {
  let s = sessionReducer(withGames('A', 'B'), { type: 'setAlgorithm', algorithm: 'double-elimination' })
  s = sessionReducer(s, { type: 'start', seed: 1 })
  expect(tournamentState(s)!.config.algorithm).toBe('double-elimination')
})

test('undo removes the last pick and is a no-op with no picks', () => {
  let s = sessionReducer(withGames('A', 'B', 'C', 'D'), { type: 'start', seed: 1 })
  expect(sessionReducer(s, { type: 'undo' })).toEqual(s)
  const before = s
  s = sessionReducer(s, { type: 'pick', winner: currentMatch(tournamentState(s)!)!.a })
  expect(sessionReducer(s, { type: 'undo' })).toEqual(before)
})

test('undo from results goes back to swiping', () => {
  let s = playToEnd(sessionReducer(withGames('A', 'B'), { type: 'start', seed: 1 }))
  s = sessionReducer(s, { type: 'undo' })
  expect(view(s)).toBe('swipe')
})

test('new tournament returns to import and keeps the list', () => {
  let s = playToEnd(sessionReducer(withGames('A', 'B'), { type: 'start', seed: 1 }))
  s = sessionReducer(s, { type: 'newTournament' })
  expect(view(s)).toBe('import')
  expect(s.swipies).toHaveLength(2)
})

test('rematch restarts with the same participants and a new seed', () => {
  let s = playToEnd(sessionReducer(withGames('A', 'B', 'C'), { type: 'start', seed: 1 }))
  s = sessionReducer(s, { type: 'rematch', seed: 2 })
  expect(view(s)).toBe('swipe')
  expect(s.tournament).toMatchObject({ picks: [], config: { seed: 2, ids: ['q:a', 'q:b', 'q:c'] } })
})

describe('rematchTop', () => {
  const finished = () => playToEnd(sessionReducer(withGames('A', 'B', 'C', 'D', 'E', 'F'), { type: 'start', seed: 1 }))

  test('restarts with the best N by ranking and keeps the full list', () => {
    const s = finished()
    const ranking = results(tournamentState(s)!).ranking
    const next = sessionReducer(s, { type: 'rematchTop', count: 3, seed: 9 })
    expect(view(next)).toBe('swipe')
    expect(next.swipies).toBe(s.swipies)
    expect(next.tournament).toMatchObject({ picks: [], config: { seed: 9, algorithm: 'dropout', ids: ranking.slice(0, 3).flatMap((t) => t.ids) } })
  })

  test('includes a whole tie that straddles the cut', () => {
    const s = finished()
    expect(topIds(results(tournamentState(s)!).ranking, 4)).toHaveLength(6)
  })

  test('is ignored before the tournament is done', () => {
    const s = sessionReducer(withGames('A', 'B', 'C'), { type: 'start', seed: 1 })
    expect(sessionReducer(s, { type: 'rematchTop', count: 2, seed: 2 })).toBe(s)
  })
})

test('editing the list is ignored while a tournament runs', () => {
  const s = sessionReducer(withGames('A', 'B'), { type: 'start', seed: 1 })
  expect(sessionReducer(s, { type: 'remove', id: 'q:a' })).toBe(s)
})

test('persists and restores through storage', () => {
  let s = sessionReducer(withGames('A', 'B', 'C'), { type: 'start', seed: 4 })
  s = sessionReducer(s, { type: 'pick', winner: currentMatch(tournamentState(s)!)!.a })
  saveSession(localStorage, s)
  expect(loadSession(localStorage)).toEqual(s)
})

test('corrupt or invalid storage falls back safely', () => {
  localStorage.setItem('swipie.session.v1', '{not json')
  expect(loadSession(localStorage)).toEqual(initialSession)
  const s = withGames('A', 'B')
  saveSession(localStorage, { ...s, tournament: { config: { algorithm: 'dropout', ids: ['q:a', 'q:b'], seed: 1 }, picks: ['zzz'], seenRounds: 0 } })
  const loaded = loadSession(localStorage)
  expect(loaded.swipies).toHaveLength(2)
  expect(loaded.tournament).toBeNull()
})

test('load replaces list and algorithm and drops any running tournament', () => {
  let s = sessionReducer(withGames('A', 'B'), { type: 'start', seed: 1 })
  s = sessionReducer(s, { type: 'load', algorithm: 'double-elimination', swipies: ['Z', 'Y'].map((name) => pendingSwipie({ name })) })
  expect(view(s)).toBe('import')
  expect(s.algorithm).toBe('double-elimination')
  expect(s.swipies.map((x) => x.name)).toEqual(['Y', 'Z'])
})

describe('round summaries', () => {
  const pickFirst = (s: Session) => sessionReducer(s, { type: 'pick', winner: currentMatch(tournamentState(s)!)!.a })

  test('after a non-final round the summary view shows until continued', () => {
    let s = sessionReducer(withGames('A', 'B', 'C', 'D'), { type: 'start', seed: 1 })
    s = pickFirst(pickFirst(s))
    expect(view(s)).toBe('summary')
    expect(sessionReducer(s, { type: 'pick', winner: 'A' })).toBe(s)
    s = sessionReducer(s, { type: 'continue' })
    expect(view(s)).toBe('swipe')
  })

  test('no summary after the final round', () => {
    let s = sessionReducer(withGames('A', 'B'), { type: 'start', seed: 1 })
    s = pickFirst(s)
    expect(view(s)).toBe('results')
  })

  test('undo on the summary returns to the last match; finishing the round again re-shows it', () => {
    let s = sessionReducer(withGames('A', 'B', 'C', 'D'), { type: 'start', seed: 1 })
    s = pickFirst(pickFirst(s))
    s = sessionReducer(s, { type: 'undo' })
    expect(view(s)).toBe('swipe')
    s = pickFirst(s)
    expect(view(s)).toBe('summary')
  })

  test('undoing back across a dismissed summary shows it again when the round re-completes', () => {
    let s = sessionReducer(withGames('A', 'B', 'C', 'D'), { type: 'start', seed: 1 })
    s = sessionReducer(pickFirst(pickFirst(s)), { type: 'continue' })
    s = sessionReducer(s, { type: 'undo' })
    expect(view(s)).toBe('swipe')
    s = pickFirst(s)
    expect(view(s)).toBe('summary')
  })

  test('a pending summary survives a reload; older saves without the field skip it', () => {
    let s = sessionReducer(withGames('A', 'B', 'C', 'D'), { type: 'start', seed: 1 })
    s = pickFirst(pickFirst(s))
    saveSession(localStorage, s)
    expect(view(loadSession(localStorage))).toBe('summary')
    const legacy = { ...s, tournament: { config: s.tournament!.config, picks: s.tournament!.picks } }
    localStorage.setItem('swipie.session.v1', JSON.stringify(legacy))
    expect(view(loadSession(localStorage))).toBe('swipe')
  })

  test('rematch starts without pending summaries', () => {
    let s = sessionReducer(withGames('A', 'B', 'C', 'D'), { type: 'start', seed: 1 })
    s = sessionReducer(pickFirst(pickFirst(s)), { type: 'rematch', seed: 3 })
    expect(view(s)).toBe('swipe')
  })
})
