import { useEffect, useId, useState } from 'react'
import type { Swipie } from '../core/swipie'
import type { SwipieSource } from '../sources/source'
import { SwipieThumb } from './SwipieCard'

interface Props {
  source: SwipieSource
  label: string
  initialQuery?: string
  autoFocus?: boolean
  isAdded?: (s: Swipie) => boolean
  onChoose: (s: Swipie) => void
  onSubmitText?: (text: string) => void
  onCancel?: () => void
}

const DEBOUNCE_MS = 250

export function GameSearch({ source, label, initialQuery = '', autoFocus, isAdded, onChoose, onSubmitText, onCancel }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<Swipie[]>([])
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const listId = useId()

  useEffect(() => {
    const q = query.trim()
    if (!source.available || q.length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      source
        .search(q, controller.signal)
        .then((r) => {
          setResults(r)
          setActive(0)
          setError(null)
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed')
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, source])

  function choose(s: Swipie) {
    onChoose(s)
    setQuery('')
    setResults([])
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setResults([])
      onCancel?.()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) choose(results[active])
      else if (query.trim() && onSubmitText) {
        onSubmitText(query.trim())
        setQuery('')
      }
    }
  }

  const open = results.length > 0
  return (
    <div className="search">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        placeholder={source.available ? 'Search games…' : 'Type a game name and press Enter'}
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {error && <p className="error">{error}</p>}
      {open && (
        <ul role="listbox" id={listId} className="search__list">
          {results.map((s, i) => {
            const added = isAdded?.(s) ?? false
            return (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'search__opt search__opt--active' : 'search__opt'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
              >
                <SwipieThumb swipie={s} size={32} decorative />
                <span className="search__name">{s.name}</span>
                {s.released && <span className="muted"> {s.released.slice(0, 4)}</span>}
                {added && <span className="badge"> added</span>}
              </li>
            )
          })}
        </ul>
      )}
      {onCancel && (
        <button type="button" className="link" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  )
}
