import {
  currentMatch,
  pick,
  progress,
  replay,
  results,
  startTournament,
  type TournamentConfig,
  type TournamentState,
} from './tournament'

const ids = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i))

// Deterministic "user": always prefers the alphabetically lowest id.
function playAll(config: TournamentConfig, prefer = (a: string, b: string) => (a < b ? a : b)) {
  let state: TournamentState = startTournament(config)
  const picks: string[] = []
  let guard = 0
  while (state.status === 'playing') {
    const m = currentMatch(state)!
    const winner = prefer(m.a, m.b)
    picks.push(winner)
    state = pick(state, winner)
    if (++guard > 1000) throw new Error('did not terminate')
  }
  return { state, picks }
}

describe('dropout', () => {
  const cfg = (n: number, seed = 1): TournamentConfig => ({ algorithm: 'dropout', ids: ids(n), seed })

  test('requires at least two swipies', () => {
    expect(() => startTournament(cfg(1))).toThrow()
  })

  test('two swipies: one match decides the winner', () => {
    const { state, picks } = playAll(cfg(2))
    expect(picks).toHaveLength(1)
    expect(results(state).winner).toBe('a')
  })

  test('current match only contains alive participants and picking a non-participant throws', () => {
    const state = startTournament(cfg(4))
    const m = currentMatch(state)!
    expect(m.a).not.toBe(m.b)
    const outsider = ids(4).find((id) => id !== m.a && id !== m.b)!
    expect(() => pick(state, outsider)).toThrow()
  })

  test.each([2, 3, 4, 5, 7, 8, 13, 16])('%i swipies: n-1 matches and the preferred one wins', (n) => {
    const { state, picks } = playAll(cfg(n))
    expect(picks).toHaveLength(n - 1)
    expect(results(state).winner).toBe('a')
  })

  test('four swipies: two rounds, two dropouts then one', () => {
    const { state } = playAll(cfg(4))
    const r = results(state).rounds
    expect(r.map((x) => x.eliminated.length)).toEqual([2, 1])
    expect(r.map((x) => x.byes.length)).toEqual([0, 0])
  })

  test('odd count gives exactly one bye per odd round', () => {
    const { state } = playAll(cfg(5))
    const r = results(state).rounds
    // 5 -> (2 matches + bye) 3 -> (1 match + bye) 2 -> 1
    expect(r.map((x) => x.matches.length)).toEqual([2, 1, 1])
    expect(r.map((x) => x.byes.length)).toEqual([1, 1, 0])
  })

  test('nobody gets two byes in a row when someone else could take it', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { state } = playAll(cfg(7, seed))
      const r = results(state).rounds
      for (let i = 1; i < r.length; i++) {
        for (const bye of r[i].byes) {
          expect(r[i - 1].byes).not.toContain(bye)
        }
      }
    }
  })

  test('every eliminated swipie records who beat it', () => {
    const { state } = playAll(cfg(6))
    for (const round of results(state).rounds) {
      for (const loser of round.eliminated) {
        expect(round.matches.some((m) => m.loser === loser)).toBe(true)
      }
    }
  })

  test('ranking: winner alone first, then groups by how far they got', () => {
    const { state } = playAll(cfg(4))
    const ranking = results(state).ranking
    expect(ranking[0]).toEqual({ place: 1, ids: ['a'] })
    expect(ranking[1].place).toBe(2)
    expect(ranking[1].ids).toHaveLength(1)
    expect(ranking[2]).toMatchObject({ place: 3 })
    expect(ranking[2].ids).toHaveLength(2)
  })

  test('same seed produces the same matchups; different seeds usually differ', () => {
    const a = playAll(cfg(8, 99)).picks
    const b = playAll(cfg(8, 99)).picks
    expect(a).toEqual(b)
    const firstMatches = new Set(
      Array.from({ length: 20 }, (_, s) => {
        const m = currentMatch(startTournament(cfg(8, s)))!
        return [m.a, m.b].sort().join()
      }),
    )
    expect(firstMatches.size).toBeGreaterThan(1)
  })

  test('replay(config, picks) equals stepping live, enabling undo', () => {
    const config = cfg(6, 5)
    const { state, picks } = playAll(config)
    expect(results(replay(config, picks))).toEqual(results(state))
    const undone = replay(config, picks.slice(0, -1))
    expect(undone.status).toBe('playing')
  })

  test('progress reports round and match position', () => {
    let state = startTournament(cfg(4))
    expect(progress(state)).toEqual({ round: 1, match: 1, matchesInRound: 2, completedMatches: 0, estimatedTotal: 3 })
    const m = currentMatch(state)!
    state = pick(state, m.a)
    expect(progress(state)).toMatchObject({ round: 1, match: 2, matchesInRound: 2, completedMatches: 1 })
  })

  test('picking after completion throws', () => {
    const { state } = playAll(cfg(2))
    expect(() => pick(state, 'a')).toThrow()
    expect(currentMatch(state)).toBeNull()
  })
})

describe('double elimination', () => {
  const cfg = (n: number, seed = 1): TournamentConfig => ({ algorithm: 'double-elimination', ids: ids(n), seed })

  test('a single loss does not eliminate', () => {
    let state = startTournament(cfg(4))
    const m = currentMatch(state)!
    state = pick(state, m.a)
    state = pick(state, currentMatch(state)!.a)
    const r1 = results(state).rounds[0]
    expect(r1.firstLosses).toHaveLength(2)
    expect(r1.eliminated).toHaveLength(0)
  })

  test('two swipies: undefeated favourite wins in 2 matches', () => {
    const { state, picks } = playAll(cfg(2))
    expect(picks).toHaveLength(2)
    expect(results(state).winner).toBe('a')
  })

  test('two swipies: the 1-loss side winning forces a deciding third match', () => {
    // first pick b, then a, then a
    const config = cfg(2)
    const state = replay(config, ['b', 'a', 'a'])
    expect(state.status).toBe('done')
    expect(results(state).winner).toBe('a')
  })

  test.each([2, 3, 4, 5, 6, 7, 8, 11, 16])('%i swipies: everyone but the winner loses twice', (n) => {
    const { state, picks } = playAll(cfg(n))
    expect(results(state).winner).toBe('a')
    // preferred one never loses => exactly 2(n-1) matches
    expect(picks).toHaveLength(2 * (n - 1))
    const eliminated = results(state).rounds.flatMap((r) => r.eliminated)
    expect(eliminated.sort()).toEqual(ids(n).slice(1))
  })

  test('matches only pair equal loss counts, except one cross match of odd leftovers', () => {
    for (let seed = 0; seed < 30; seed++) {
      let state = startTournament(cfg(9, seed))
      while (state.status === 'playing') {
        if (state.matchIndex > 0) {
          const m = currentMatch(state)!
          state = pick(state, m.a < m.b ? m.a : m.b)
          continue
        }
        const crossMatches = state.plan.matches.filter((m) => state.losses[m.a] !== state.losses[m.b])
        expect(crossMatches.length).toBeLessThanOrEqual(1)
        if (crossMatches.length === 1) expect(state.plan.byes).toHaveLength(0)
        const m = currentMatch(state)!
        state = pick(state, m.a < m.b ? m.a : m.b)
      }
    }
  })

  test('progress estimate is exact at the end and never overshoots completed matches', () => {
    const config = cfg(5, 3)
    const { picks } = playAll(config, (a, b) => (a > b ? a : b))
    for (let i = 0; i <= picks.length; i++) {
      const p = progress(replay(config, picks.slice(0, i)))
      expect(p.estimatedTotal).toBeGreaterThanOrEqual(p.completedMatches)
      expect(p.estimatedTotal).toBeLessThanOrEqual(picks.length)
    }
    expect(progress(replay(config, picks)).estimatedTotal).toBe(picks.length)
  })

  test('ranking places the last eliminated as runner-up', () => {
    const { state } = playAll(cfg(6))
    const { ranking, rounds } = results(state)
    expect(ranking[0].ids).toEqual(['a'])
    expect(ranking[1].ids).toEqual(rounds[rounds.length - 1].eliminated)
    expect(ranking.flatMap((t) => t.ids).sort()).toEqual(ids(6))
  })
})
