import { useState } from 'react'
import { ImportError, parseImport, SAMPLE_IMPORT, type ImportEntry } from '../core/importParser'
import type { Session, SessionAction } from '../core/session'
import { encodeShare } from '../core/shareLink'
import type { Swipie } from '../core/swipie'
import { ALGORITHMS, type AlgorithmId } from '../core/tournament'
import type { SwipieSource } from '../sources/source'
import { GameSearch } from './GameSearch'
import { SwipieMeta, SwipieThumb } from './SwipieCard'

interface Props {
  session: Session
  dispatch: (a: SessionAction) => void
  source: SwipieSource
  onImport: (entries: ImportEntry[]) => Promise<void>
  onStart: () => void
}
const SAMPLE_HREF = `data:application/json;charset=utf-8,${encodeURIComponent(SAMPLE_IMPORT)}`

export function ImportPage({ session, dispatch, source, onImport, onStart }: Props) {
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [changing, setChanging] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const { swipies } = session

  const isAdded = (s: Swipie) => swipies.some((x) => x.id === s.id || x.name.toLowerCase() === s.name.toLowerCase())

  function importEntries(entries: ImportEntry[]) {
    void onImport(entries)
    setStatus(`Added ${entries.length} game${entries.length === 1 ? '' : 's'}`)
  }

  async function copyShareLink() {
    const url = `${location.origin}${location.pathname}#${encodeShare(session)}`
    setShareUrl(url)
    try {
      await navigator.clipboard.writeText(url)
      setStatus('Share link copied')
    } catch {
      setStatus('Copy the share link below')
    }
  }

  function importText(text: string): boolean {
    try {
      setError(null)
      importEntries(parseImport(text))
      return true
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'Could not import')
      return false
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) importText(await file.text())
  }

  function addChosen(s: Swipie) {
    if (isAdded(s)) {
      setStatus(`${s.name} is already in the list`)
      return
    }
    dispatch({ type: 'add', swipies: [{ ...s, query: s.name }] })
    setStatus(`Added ${s.name}`)
  }

  return (
    <div className="page import">
      <section className="panel">
        <h2>1. Add games</h2>
        {!source.available && (
          <p className="notice">RAWG API key not configured, so games are added by name only (no pictures or ratings).</p>
        )}
        <GameSearch
          source={source}
          label="Search games"
          isAdded={isAdded}
          onChoose={addChosen}
          onSubmitText={(text) => importEntries([{ name: text }])}
        />
        <div className="import__row">
          <label className="filebtn">
            Import file (.json / .txt)
            <input type="file" accept=".json,.txt,application/json,text/plain" onChange={onFile} />
          </label>
          <a className="link" href={SAMPLE_HREF} download="swipie-sample.json">
            Download sample JSON
          </a>
        </div>
        <div className="paste">
          <textarea
            aria-label="Paste games (one per line, or JSON)"
            placeholder={'Hades\nCeleste\nPortal 2'}
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button type="button" onClick={() => importText(pasted) && setPasted('')} disabled={!pasted.trim()}>
            Add pasted games
          </button>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <p role="status" className="status">{status}</p>
      </section>

      <section className="panel">
        <div className="list__head">
          <h2>2. Games ({swipies.length})</h2>
          {swipies.length > 0 && (
            <button type="button" className="link" onClick={() => dispatch({ type: 'clear' })}>
              Clear all
            </button>
          )}
        </div>
        <ul aria-label="Games" className="games">
          {swipies.map((s) => (
            <li key={s.id} data-name={s.name} className="game">
              <SwipieThumb swipie={s} />
              <div className="game__info">
                <span className="game__name">
                  {s.link ? (
                    <a href={s.link} target="_blank" rel="noreferrer">
                      {s.name}
                    </a>
                  ) : (
                    s.name
                  )}
                </span>
                <SwipieMeta swipie={s} />
                {s.status === 'resolved' && s.query.toLowerCase() !== s.name.toLowerCase() && (
                  <span className="muted">from "{s.query}"</span>
                )}
                {s.status === 'not-found' && <span className="badge badge--warn">not found</span>}
                {s.status === 'pending' && source.available && <span className="muted">looking up…</span>}
                {changing === s.id && (
                  <GameSearch
                    source={source}
                    label={`Find a different match for ${s.name}`}
                    initialQuery={s.query}
                    autoFocus
                    isAdded={isAdded}
                    onChoose={(next) => {
                      dispatch({ type: 'replace', id: s.id, swipie: { ...next, query: s.query } })
                      setChanging(null)
                    }}
                    onCancel={() => setChanging(null)}
                  />
                )}
              </div>
              <div className="game__actions">
                {source.available && changing !== s.id && (
                  <button type="button" className="link" aria-label={`Change ${s.name}`} onClick={() => setChanging(s.id)}>
                    change
                  </button>
                )}
                <button type="button" className="icon" aria-label={`Remove ${s.name}`} onClick={() => dispatch({ type: 'remove', id: s.id })}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>3. Algorithm</h2>
        <div className="algos" role="radiogroup" aria-label="Algorithm">
          {(Object.keys(ALGORITHMS) as AlgorithmId[]).map((id) => (
            <label key={id} className="algo">
              <input
                type="radio"
                name="algorithm"
                value={id}
                checked={session.algorithm === id}
                onChange={() => dispatch({ type: 'setAlgorithm', algorithm: id })}
              />
              <span>
                <strong>{ALGORITHMS[id].label}</strong>
                <span className="muted">
                  {id === 'dropout' ? ' Lose once and you are out.' : ' Out after two losses.'}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="start-row">
          <button type="button" className="primary" disabled={swipies.length < 2} onClick={onStart}>
            Start swiping
          </button>
          <button type="button" disabled={swipies.length === 0} onClick={copyShareLink}>
            Copy share link
          </button>
        </div>
        {shareUrl && (
          <input className="share-url" aria-label="Share link" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
        )}
      </section>
    </div>
  )
}
