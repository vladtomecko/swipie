import { useEffect, useId, useRef, useState } from 'react'
import { batchCandidates, type BatchCandidate } from '../core/batchFilter'
import type { Swipie } from '../core/swipie'
import type { SwipieSource } from '../sources/source'
import { SwipieThumb } from './SwipieCard'

interface Props {
  source: SwipieSource
  query: string
  isAdded: (s: Swipie) => boolean
  onAdd: (swipies: Swipie[]) => void
  onClose: () => void
  today?: string
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; candidates: BatchCandidate[] }

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const plural = (n: number) => `${n} game${n === 1 ? '' : 's'}`

export function BatchAddDialog({ source, query, isAdded, onAdd, onClose, today = localToday() }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const dialogRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const isAddedRef = useRef(isAdded)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    source
      .searchAll(query, controller.signal)
      .then((games) => {
        const candidates = batchCandidates(games, { query, today, isAdded: isAddedRef.current })
        setLoad({ state: 'ready', candidates })
        setSelected(new Set(candidates.filter((c) => c.selected).map((c) => c.swipie.id)))
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setLoad({ state: 'error', message: e instanceof Error ? e.message : 'Search failed' })
      })
    return () => controller.abort()
  }, [source, query, today])

  const candidates = load.state === 'ready' ? load.candidates : []
  const selectable = candidates.filter((c) => !c.added)
  const chosen = selectable.filter((c) => selected.has(c.swipie.id))

  function toggle(swipieId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(swipieId)) next.add(swipieId)
      return next
    })
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className="dialog"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <header className="dialog__head">
          <h2 id={`${id}-title`}>Add games matching "{query}"</h2>
          {load.state === 'ready' && candidates.length > 0 && (
            <div className="dialog__tools">
              <span className="muted">{plural(candidates.length)} found</span>
              <button type="button" className="link" onClick={() => setSelected(new Set(selectable.map((c) => c.swipie.id)))}>
                Select all
              </button>
              <button type="button" className="link" onClick={() => setSelected(new Set())}>
                Select none
              </button>
            </div>
          )}
        </header>
        <div className="dialog__body">
          {load.state === 'loading' && <p className="muted">Finding games…</p>}
          {load.state === 'error' && (
            <p role="alert" className="error">
              {load.message}
            </p>
          )}
          {load.state === 'ready' && candidates.length === 0 && <p className="muted">No released games match "{query}".</p>}
          {candidates.length > 0 && (
            <ul className="batch">
              {candidates.map(({ swipie: s, added }, i) => {
                const year = s.released?.slice(0, 4)
                return (
                  <li key={s.id}>
                    <label className={added ? 'batch__item batch__item--added' : 'batch__item'}>
                      <input
                        type="checkbox"
                        checked={!added && selected.has(s.id)}
                        disabled={added}
                        onChange={() => toggle(s.id)}
                        aria-labelledby={`${id}-n${i}`}
                        aria-describedby={`${id}-d${i}`}
                      />
                      <SwipieThumb swipie={s} size={40} decorative />
                      <span className="batch__text">
                        <span id={`${id}-n${i}`} className="batch__name">
                          {s.name}
                        </span>
                        <span id={`${id}-d${i}`} className="meta">
                          {year && <span>{year}</span>}
                          {s.rating !== undefined && <span>★ {s.rating.toFixed(1)}</span>}
                          {added && <span className="badge">already added</span>}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <footer className="dialog__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={chosen.length === 0} onClick={() => onAdd(chosen.map((c) => c.swipie))}>
            Add {plural(chosen.length)}
          </button>
        </footer>
      </div>
    </div>
  )
}
