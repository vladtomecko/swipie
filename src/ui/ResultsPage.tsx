import type { SessionAction } from '../core/session'
import type { Swipie } from '../core/swipie'
import { results, type TournamentState } from '../core/tournament'
import { SwipieCard, SwipieThumb } from './SwipieCard'

interface Props {
  state: TournamentState
  byId: (id: string) => Swipie
  dispatch: (a: SessionAction) => void
  seed: () => number
}

export function ResultsPage({ state, byId, dispatch, seed }: Props) {
  const { winner, rounds, ranking } = results(state)
  const champ = byId(winner!)
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
      </section>

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
