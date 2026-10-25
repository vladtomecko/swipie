import { useEffect, useRef } from 'react'
import type { SessionAction } from '../core/session'
import type { Swipie } from '../core/swipie'
import { ALGORITHMS, type RoundRecord, type TournamentState } from '../core/tournament'
import { SwipieThumb } from './SwipieCard'

interface Props {
  state: TournamentState
  byId: (id: string) => Swipie
  dispatch: (a: SessionAction) => void
}

const SWIPE_THRESHOLD = 80

function LossList({ label, ids, round, byId, verb }: { label: string; ids: string[]; round: RoundRecord; byId: Props['byId']; verb: string }) {
  if (ids.length === 0) return null
  const winnerOver = (id: string) => byId(round.matches.find((m) => m.loser === id)!.winner).name
  return (
    <div className="summary__group">
      <h3>{label}</h3>
      <ul aria-label={label} className="round__list">
        {ids.map((id) => (
          <li key={id}>
            <SwipieThumb swipie={byId(id)} size={32} decorative />
            <span className="round__name">{byId(id).name}</span>
            <span className="by">
              {verb} {winnerOver(id)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Survivors({ label, ids, byId }: { label: string; ids: string[]; byId: Props['byId'] }) {
  if (ids.length === 0) return null
  return (
    <div className="summary__group">
      <h3>
        {label} ({ids.length})
      </h3>
      <ul aria-label={label} className="survivors">
        {ids.map((id) => (
          <li key={id} title={byId(id).name}>
            <SwipieThumb swipie={byId(id)} size={40} />
            <span className="survivors__name">{byId(id).name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RoundSummary({ state, byId, dispatch }: Props) {
  const round = state.rounds[state.rounds.length - 1]
  const maxLosses = ALGORITHMS[state.config.algorithm].maxLosses
  const alive = state.config.ids.filter((id) => state.losses[id] < maxLosses)
  const next = () => dispatch({ type: 'continue' })
  const undo = () => dispatch({ type: 'undo' })
  const drag = useRef<number | null>(null)

  const latest = useRef({ next, undo })
  latest.current = { next, undo }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['Enter', ' ', 'ArrowRight'].includes(e.key)) latest.current.next()
      else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') latest.current.undo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="page panel summary"
      data-testid="round-summary"
      onPointerDown={(e) => (drag.current = e.clientX)}
      onPointerUp={(e) => {
        if (drag.current !== null && Math.abs(e.clientX - drag.current) >= SWIPE_THRESHOLD) next()
        drag.current = null
      }}
      onPointerCancel={() => (drag.current = null)}
      style={{ touchAction: 'pan-y' }}
    >
      <h2>Round {round.round} complete</h2>
      <LossList label="Dropped out" ids={round.eliminated} round={round} byId={byId} verb="beaten by" />
      <LossList label="First loss" ids={round.firstLosses} round={round} byId={byId} verb="lost to" />
      {maxLosses > 1 ? (
        <>
          <Survivors label="Undefeated" ids={alive.filter((id) => state.losses[id] === 0)} byId={byId} />
          <Survivors label="One loss" ids={alive.filter((id) => state.losses[id] === 1)} byId={byId} />
        </>
      ) : (
        <Survivors label="Still in" ids={alive} byId={byId} />
      )}
      <div className="actions">
        <button type="button" onClick={undo}>
          Undo
        </button>
        <button type="button" className="primary" onClick={next}>
          Next round
        </button>
      </div>
      <p className="hint muted">Enter, Space, → or swipe to continue.</p>
    </div>
  )
}
