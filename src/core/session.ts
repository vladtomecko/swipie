import { addSwipies, removeSwipie, replaceSwipie, type Swipie } from './swipie'
import { ALGORITHMS, replay, type AlgorithmId, type SwipieId, type TournamentConfig, type TournamentState } from './tournament'

export interface TournamentRecord {
  config: TournamentConfig
  picks: SwipieId[]
}

export interface Session {
  swipies: Swipie[]
  algorithm: AlgorithmId
  tournament: TournamentRecord | null
}

export type SessionAction =
  | { type: 'add'; swipies: Swipie[] }
  | { type: 'remove'; id: string }
  | { type: 'replace'; id: string; swipie: Swipie }
  | { type: 'clear' }
  | { type: 'setAlgorithm'; algorithm: AlgorithmId }
  | { type: 'start'; seed: number }
  | { type: 'pick'; winner: SwipieId }
  | { type: 'undo' }
  | { type: 'newTournament' }
  | { type: 'rematch'; seed: number }

export type View = 'import' | 'swipe' | 'results'

export const initialSession: Session = { swipies: [], algorithm: 'dropout', tournament: null }

const cache = new WeakMap<TournamentRecord, TournamentState>()

export function tournamentState(session: Session): TournamentState | null {
  const record = session.tournament
  if (!record) return null
  let state = cache.get(record)
  if (!state) {
    state = replay(record.config, record.picks)
    cache.set(record, state)
  }
  return state
}

export function view(session: Session): View {
  const state = tournamentState(session)
  if (!state) return 'import'
  return state.status === 'done' ? 'results' : 'swipe'
}

function startWith(session: Session, ids: SwipieId[], seed: number): Session {
  if (ids.length < 2) return session
  return { ...session, tournament: { config: { algorithm: session.algorithm, ids, seed }, picks: [] } }
}

export function sessionReducer(session: Session, action: SessionAction): Session {
  const editing = session.tournament === null
  switch (action.type) {
    case 'add':
      return editing ? { ...session, swipies: addSwipies(session.swipies, action.swipies) } : session
    case 'remove':
      return editing ? { ...session, swipies: removeSwipie(session.swipies, action.id) } : session
    case 'replace':
      return editing ? { ...session, swipies: replaceSwipie(session.swipies, action.id, action.swipie) } : session
    case 'clear':
      return editing ? { ...session, swipies: [] } : session
    case 'setAlgorithm':
      return editing ? { ...session, algorithm: action.algorithm } : session
    case 'start':
      return editing ? startWith(session, session.swipies.map((s) => s.id), action.seed) : session
    case 'pick': {
      const record = session.tournament
      if (!record || tournamentState(session)?.status !== 'playing') return session
      return { ...session, tournament: { ...record, picks: [...record.picks, action.winner] } }
    }
    case 'undo': {
      const record = session.tournament
      if (!record || record.picks.length === 0) return session
      return { ...session, tournament: { ...record, picks: record.picks.slice(0, -1) } }
    }
    case 'newTournament':
      return { ...session, tournament: null }
    case 'rematch': {
      const record = session.tournament
      if (!record) return session
      return { ...session, algorithm: record.config.algorithm, tournament: { config: { ...record.config, seed: action.seed }, picks: [] } }
    }
  }
}

const STORAGE_KEY = 'swipie.session.v1'

export function saveSession(storage: Storage, session: Session) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // storage full or unavailable: the app keeps working in memory
  }
}

export function loadSession(storage: Storage): Session {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return initialSession
    const data = JSON.parse(raw) as Partial<Session>
    if (!Array.isArray(data.swipies)) return initialSession
    const algorithm = data.algorithm && data.algorithm in ALGORITHMS ? data.algorithm : 'dropout'
    const session: Session = { swipies: data.swipies, algorithm, tournament: data.tournament ?? null }
    try {
      tournamentState(session)
      return session
    } catch {
      return { ...session, tournament: null }
    }
  } catch {
    return initialSession
  }
}
