import { useState } from 'react'
import { resultsToCsv, resultsToJson, shareText } from '../core/exportResults'
import { compareRankings, type Comparison, type FriendResult } from '../core/friend'
import type { SessionAction } from '../core/session'
import { encodeShare } from '../core/shareLink'
import type { Swipie } from '../core/swipie'
import { results, type TournamentState } from '../core/tournament'
import { SwipieCard, SwipieThumb } from './SwipieCard'

interface Props {
  state: TournamentState
  swipies: readonly Swipie[]
  byId: (id: string) => Swipie
  dispatch: (a: SessionAction) => void
  seed: () => number
  friend: FriendResult | null
  onForgetFriend: () => void
}

const dataUri = (type: string, text: string) => `data:${type};charset=utf-8,${encodeURIComponent(text)}`

export function ResultsPage({ state, swipies, byId, dispatch, seed, friend, onForgetFriend }: Props) {
  const res = results(state)
  const { winner, rounds, ranking } = res
  const champ = byId(winner!)
  const algorithm = state.config.algorithm
  const total = state.config.ids.length
  const [status, setStatus] = useState('')

  async function shareResult() {
    const hash = encodeShare({ algorithm, swipies, ranking: ranking.map((t) => t.ids.map(byId)) })
    const text = shareText(res, byId, `${window.location.origin}${window.location.pathname}#${hash}`)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setStatus('Result copied')
    } catch {
      setStatus('Could not share the result')
    }
  }
  const beatenBy = (round: (typeof rounds)[number], id: string) => byId(round.matches.find((m) => m.loser === id)!.winner).name

  return (
    <div className="page results">
      <section className="panel hero">
        <h2>Winner</h2>
        <div data-testid="winner">
          <SwipieCard swipie={champ} />
        </div>
        <div className="hero__links">
          {champ.link && (
            <a href={champ.link} target="_blank" rel="noreferrer">
              RAWG
            </a>
          )}
          {champ.stores?.map((st) => (
            <a key={st.name} href={st.url} target="_blank" rel="noreferrer">
              {st.name}
            </a>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={() => dispatch({ type: 'rematch', seed: seed() })}>
            Rematch
          </button>
          <button type="button" onClick={() => dispatch({ type: 'newTournament' })}>
            New tournament
          </button>
          <button type="button" className="link" onClick={() => dispatch({ type: 'undo' })}>
            Undo last pick
          </button>
        </div>
        {total > 4 && (
          <div className="actions">
            {[4, 8]
              .filter((n) => n < total)
              .map((n) => (
                <button key={n} type="button" onClick={() => dispatch({ type: 'rematchTop', count: n, seed: seed() })}>
                  Rematch top {n}
                </button>
              ))}
          </div>
        )}
        <div className="actions">
          <button type="button" onClick={() => void shareResult()}>
            Share result
          </button>
          <a className="button" href={dataUri('application/json', resultsToJson(algorithm, res, byId))} download="swipie-results.json">
            Download JSON
          </a>
          <a className="button" href={dataUri('text/csv', resultsToCsv(res, byId))} download="swipie-results.csv">
            Download CSV
          </a>
        </div>
        <p role="status" className="status">
          {status}
        </p>
      </section>

      {friend && <FriendComparison comparison={compareRankings(ranking, byId, friend)} onForget={onForgetFriend} />}

      <section className="panel" aria-label="Ranking">
        <h2>Ranking</h2>
        <ol className="ranking">
          {ranking.map((tier) => (
            <li key={tier.place}>
              <span className="place">{tier.ids.length > 1 ? `=${tier.place}` : tier.place}</span>
              <span>{tier.ids.map((id) => byId(id).name).join(', ')}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel" aria-label="Timeline">
        <h2>Timeline</h2>
        {rounds.map((round) => (
          <div key={round.round} className="round">
            <h3>Round {round.round}</h3>
            <ul className="round__list">
              {round.eliminated.map((id) => (
                <li key={id} className="out">
                  <SwipieThumb swipie={byId(id)} size={28} decorative />
                  <span className="round__name">{byId(id).name}</span>
                  <span className="tag tag--out">out</span>
                  <span className="by">beaten by {beatenBy(round, id)}</span>
                </li>
              ))}
              {round.firstLosses.map((id) => (
                <li key={id}>
                  <SwipieThumb swipie={byId(id)} size={28} decorative />
                  <span className="round__name">{byId(id).name}</span>
                  <span className="tag tag--warn">first loss</span>
                  <span className="by">to {beatenBy(round, id)}</span>
                </li>
              ))}
              {round.byes.map((id) => (
                <li key={id}>
                  <SwipieThumb swipie={byId(id)} size={28} decorative />
                  <span className="round__name">{byId(id).name}</span>
                  <span className="tag">bye</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}

function FriendComparison({ comparison: c, onForget }: { comparison: Comparison; onForget: () => void }) {
  return (
    <section className="panel compare" aria-label="Compare with friend">
      <h2>Compare with friend</h2>
      <p className="compare__headline">{c.sameWinner ? 'You agree on the winner!' : `Different winners: yours ${c.myWinner}, theirs ${c.theirWinner}`}</p>
      <p>
        <strong>{c.agreement}% agreement</strong> <span className="muted">— share of games placed within one spot of each other</span>
      </p>
      <table className="compare__table">
        <thead>
          <tr>
            <th scope="col">Game</th>
            <th scope="col">You</th>
            <th scope="col">Friend</th>
          </tr>
        </thead>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.mine}</td>
              <td>{r.theirs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="link" onClick={onForget}>
        Forget friend's result
      </button>
    </section>
  )
}
