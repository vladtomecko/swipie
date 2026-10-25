import { useEffect, useRef, useState } from 'react'
import type { SessionAction } from '../core/session'
import type { Swipie } from '../core/swipie'
import { ALGORITHMS, currentMatch, progress, type TournamentState } from '../core/tournament'
import { SwipieCard } from './SwipieCard'

interface Props {
  state: TournamentState
  canUndo: boolean
  byId: (id: string) => Swipie
  dispatch: (a: SessionAction) => void
  random?: () => number
}

const SWIPE_THRESHOLD = 80

export function SwipePage({ state, canUndo, byId, dispatch, random = Math.random }: Props) {
  const match = currentMatch(state)!
  const p = progress(state)
  const [dx, setDx] = useState(0)
  const drag = useRef<{ startX: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const pickSide = (side: 'left' | 'right') => dispatch({ type: 'pick', winner: side === 'left' ? match.a : match.b })
  const undo = () => dispatch({ type: 'undo' })
  const [randomPick, setRandomPick] = useState<{ name: string; at: number } | null>(null)
  const pickRandom = () => {
    const winner = random() < 0.5 ? match.a : match.b
    setRandomPick({ name: byId(winner).name, at: p.completedMatches + 1 })
    dispatch({ type: 'pick', winner })
  }
  const randomMessage = randomPick?.at === p.completedMatches ? `Randomly picked ${randomPick.name}` : ''

  const latest = useRef({ pickSide, undo, pickRandom })
  latest.current = { pickSide, undo, pickRandom }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (e.key === 'ArrowLeft') latest.current.pickSide('left')
      else if (e.key === 'ArrowRight') latest.current.pickSide('right')
      else if (e.key.toLowerCase() === 'r') latest.current.pickRandom()
      else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') latest.current.undo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startX: e.clientX, moved: false }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const d = e.clientX - drag.current.startX
    if (Math.abs(d) > 5) drag.current.moved = true
    setDx(d)
  }
  function onPointerEnd(e: React.PointerEvent) {
    if (!drag.current) return
    const d = e.clientX - drag.current.startX
    suppressClick.current = drag.current.moved
    drag.current = null
    setDx(0)
    if (Math.abs(d) >= SWIPE_THRESHOLD) pickSide(d < 0 ? 'left' : 'right')
  }
  function onCardClick(side: 'left' | 'right') {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    pickSide(side)
  }

  const doubleElim = ALGORITHMS[state.config.algorithm].maxLosses > 1
  const lossBadge = (id: string) => (doubleElim && state.losses[id] > 0 ? `${state.losses[id]} loss` : undefined)
  const leaning = dx <= -SWIPE_THRESHOLD ? 'left' : dx >= SWIPE_THRESHOLD ? 'right' : null
  const pct = Math.round((p.completedMatches / p.estimatedTotal) * 100)

  return (
    <div className="page swipe">
      <div className="progress">
        <div className="progress__text">
          <span>Round {p.round}</span>
          <span>
            Match {p.match} of {p.matchesInRound}
          </span>
        </div>
        <div className="progress__bar" role="progressbar" aria-label="Tournament progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div
        className="stage"
        data-testid="swipe-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={() => {
          drag.current = null
          setDx(0)
        }}
        style={{ touchAction: 'pan-y' }}
      >
        {(['left', 'right'] as const).map((side) => {
          const id = side === 'left' ? match.a : match.b
          const s = byId(id)
          return (
            <button
              key={`${state.round}-${state.matchIndex}-${side}`}
              type="button"
              className={`pick pick--${side}${leaning === side ? ' pick--leaning' : ''}`}
              aria-label={`Pick ${s.name}`}
              data-id={id}
              onClick={() => onCardClick(side)}
              style={{ transform: `translateX(${dx * 0.3}px) rotate(${dx * 0.02}deg)` }}
            >
              <SwipieCard swipie={s} badge={lossBadge(id)} />
            </button>
          )
        })}
        <span className="vs" aria-hidden="true">
          vs
        </span>
      </div>

      <p className="hint muted">Tap a card, swipe, or press ← (first) / → (second). R for random, Z to undo.</p>
      <p role="status" className="status">{randomMessage}</p>
      <div className="actions">
        <button type="button" onClick={pickRandom}>
          Can't decide (random)
        </button>
        <button type="button" onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="link" onClick={() => dispatch({ type: 'newTournament' })}>
          Quit to list
        </button>
      </div>
    </div>
  )
}
