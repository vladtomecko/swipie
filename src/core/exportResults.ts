import type { Swipie } from './swipie'
import type { AlgorithmId, SwipieId, TournamentResults } from './tournament'

type ById = (id: SwipieId) => Swipie

const game = (s: Swipie) => (s.rawgId ? { name: s.name, rawgId: s.rawgId } : { name: s.name })

export function resultsToJson(algorithm: AlgorithmId, { winner, ranking, rounds }: TournamentResults, byId: ById): string {
  const name = (id: SwipieId) => byId(id).name
  const data = {
    algorithm,
    winner: winner ? name(winner) : null,
    ranking: ranking.map((t) => ({ place: t.place, games: t.ids.map((id) => game(byId(id))) })),
    rounds: rounds.map((r) => ({
      round: r.round,
      eliminated: r.eliminated.map(name),
      firstLosses: r.firstLosses.map(name),
      byes: r.byes.map(name),
      matches: r.matches.map((m) => ({ winner: name(m.winner), loser: name(m.loser) })),
    })),
  }
  return JSON.stringify(data, null, 2)
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function resultsToCsv({ ranking }: TournamentResults, byId: ById): string {
  const rows = ranking.flatMap((t) => t.ids.map((id) => byId(id)).map((s) => [String(t.place), csvCell(s.name), s.rawgId ? String(s.rawgId) : ''].join(',')))
  return ['place,name,rawgId', ...rows].join('\n') + '\n'
}

export function shareText({ ranking }: TournamentResults, byId: ById, url: string): string {
  const names = (ids: SwipieId[]) => ids.map((id) => byId(id).name).join(' / ')
  const lines = ranking.slice(0, 3).map((t) => `${t.place}. ${names(t.ids)}`)
  return [`My Swipie winner: ${names(ranking[0].ids)} 🏆`, ...lines, `Swipe yours: ${url}`].join('\n')
}
