import { createRng, shuffle } from './rng'

export type SwipieId = string
export type AlgorithmId = 'dropout' | 'double-elimination'

export interface TournamentConfig {
  algorithm: AlgorithmId
  ids: SwipieId[]
  seed: number
}

export interface Match {
  a: SwipieId
  b: SwipieId
}

export interface MatchResult {
  winner: SwipieId
  loser: SwipieId
}

export interface RoundRecord {
  round: number
  matches: MatchResult[]
  byes: SwipieId[]
  firstLosses: SwipieId[]
  eliminated: SwipieId[]
}

export interface RankTier {
  place: number
  ids: SwipieId[]
}

export interface TournamentResults {
  winner: SwipieId | null
  rounds: RoundRecord[]
  ranking: RankTier[]
}

export interface Progress {
  round: number
  match: number
  matchesInRound: number
  completedMatches: number
  estimatedTotal: number
}

interface RoundPlan {
  matches: Match[]
  byes: SwipieId[]
}

export interface TournamentState {
  readonly config: TournamentConfig
  readonly status: 'playing' | 'done'
  readonly losses: Readonly<Record<SwipieId, number>>
  readonly round: number
  readonly plan: RoundPlan
  readonly matchIndex: number
  readonly currentResults: readonly MatchResult[]
  readonly rounds: readonly RoundRecord[]
}

export const ALGORITHMS: Record<AlgorithmId, { label: string; maxLosses: number }> = {
  dropout: { label: 'Dropout', maxLosses: 1 },
  'double-elimination': { label: 'Double elimination', maxLosses: 2 },
}

const maxLossesOf = (config: TournamentConfig) => ALGORITHMS[config.algorithm].maxLosses

function aliveIds(config: TournamentConfig, losses: Readonly<Record<SwipieId, number>>): SwipieId[] {
  const max = maxLossesOf(config)
  return config.ids.filter((id) => losses[id] < max)
}

function roundRng(seed: number, round: number) {
  return createRng((seed + Math.imul(round, 0x9e3779b9)) >>> 0)
}

// Pair within loss-count groups; odd leftovers of two groups meet each other, a lone leftover gets a bye.
function planRound(
  config: TournamentConfig,
  losses: Readonly<Record<SwipieId, number>>,
  round: number,
  previousByes: readonly SwipieId[],
): RoundPlan {
  const rng = roundRng(config.seed, round)
  const alive = aliveIds(config, losses)
  const matches: Match[] = []
  const leftovers: SwipieId[] = []

  for (let l = 0; l < maxLossesOf(config); l++) {
    const group = shuffle(
      alive.filter((id) => losses[id] === l),
      rng,
    )
    if (group.length % 2 === 1) {
      const idx = Math.max(
        0,
        group.findIndex((id) => !previousByes.includes(id)),
      )
      leftovers.push(group.splice(idx, 1)[0])
    }
    for (let i = 0; i < group.length; i += 2) matches.push({ a: group[i], b: group[i + 1] })
  }

  if (leftovers.length === 2) return { matches: [...matches, { a: leftovers[0], b: leftovers[1] }], byes: [] }
  return { matches, byes: leftovers }
}

export function startTournament(config: TournamentConfig): TournamentState {
  if (new Set(config.ids).size !== config.ids.length) throw new Error('Duplicate ids')
  if (config.ids.length < 2) throw new Error('Need at least two swipies')
  const losses = Object.fromEntries(config.ids.map((id) => [id, 0]))
  return {
    config,
    status: 'playing',
    losses,
    round: 1,
    plan: planRound(config, losses, 1, []),
    matchIndex: 0,
    currentResults: [],
    rounds: [],
  }
}

export function currentMatch(state: TournamentState): Match | null {
  return state.status === 'playing' ? state.plan.matches[state.matchIndex] : null
}

export function pick(state: TournamentState, winner: SwipieId): TournamentState {
  const match = currentMatch(state)
  if (!match) throw new Error('Tournament is finished')
  if (winner !== match.a && winner !== match.b) throw new Error(`${winner} is not in the current match`)
  const loser = winner === match.a ? match.b : match.a

  const losses = { ...state.losses, [loser]: state.losses[loser] + 1 }
  const currentResults = [...state.currentResults, { winner, loser }]

  if (state.matchIndex + 1 < state.plan.matches.length) {
    return { ...state, losses, currentResults, matchIndex: state.matchIndex + 1 }
  }

  const max = maxLossesOf(state.config)
  const losers = currentResults.map((r) => r.loser)
  const record: RoundRecord = {
    round: state.round,
    matches: currentResults,
    byes: state.plan.byes,
    firstLosses: max > 1 ? losers.filter((id) => losses[id] === 1) : [],
    eliminated: losers.filter((id) => losses[id] >= max),
  }
  const rounds = [...state.rounds, record]

  if (aliveIds(state.config, losses).length === 1) {
    return { ...state, status: 'done', losses, rounds, currentResults: [], matchIndex: 0, plan: { matches: [], byes: [] } }
  }

  const round = state.round + 1
  return {
    ...state,
    losses,
    rounds,
    round,
    plan: planRound(state.config, losses, round, record.byes),
    matchIndex: 0,
    currentResults: [],
  }
}

export function replay(config: TournamentConfig, picks: readonly SwipieId[]): TournamentState {
  return picks.reduce(pick, startTournament(config))
}

export function progress(state: TournamentState): Progress {
  const completedMatches = state.rounds.reduce((n, r) => n + r.matches.length, 0) + state.currentResults.length
  const alive = aliveIds(state.config, state.losses)
  const minAliveLosses = Math.min(...alive.map((id) => state.losses[id]))
  return {
    round: state.round,
    match: state.matchIndex + 1,
    matchesInRound: state.plan.matches.length,
    completedMatches,
    estimatedTotal: (state.config.ids.length - 1) * maxLossesOf(state.config) + minAliveLosses,
  }
}

export function results(state: TournamentState): TournamentResults {
  const winner = state.status === 'done' ? aliveIds(state.config, state.losses)[0] : null
  const ranking: RankTier[] = []
  if (winner) {
    ranking.push({ place: 1, ids: [winner] })
    let place = 2
    for (const round of [...state.rounds].reverse()) {
      if (round.eliminated.length === 0) continue
      ranking.push({ place, ids: [...round.eliminated] })
      place += round.eliminated.length
    }
  }
  return { winner, rounds: [...state.rounds], ranking }
}
