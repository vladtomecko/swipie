import { resultsToCsv, resultsToJson, shareText } from './exportResults'
import type { Swipie } from './swipie'
import type { TournamentResults } from './tournament'

const games: Record<string, Swipie> = {
  a: { id: 'a', name: 'Hades', query: 'Hades', status: 'resolved', rawgId: 3 },
  b: { id: 'b', name: 'Celeste, Deluxe', query: 'x', status: 'resolved' },
  c: { id: 'c', name: 'Portal', query: 'x', status: 'resolved' },
  d: { id: 'd', name: 'Doom', query: 'x', status: 'resolved' },
}
const byId = (id: string) => games[id]
const res: TournamentResults = {
  winner: 'a',
  rounds: [
    { round: 1, matches: [{ winner: 'a', loser: 'c' }, { winner: 'b', loser: 'd' }], byes: [], firstLosses: [], eliminated: ['c', 'd'] },
    { round: 2, matches: [{ winner: 'a', loser: 'b' }], byes: [], firstLosses: [], eliminated: ['b'] },
  ],
  ranking: [
    { place: 1, ids: ['a'] },
    { place: 2, ids: ['b'] },
    { place: 3, ids: ['c', 'd'] },
  ],
}

test('JSON uses names and optional RAWG ids', () => {
  expect(JSON.parse(resultsToJson('dropout', res, byId))).toEqual({
    algorithm: 'dropout',
    winner: 'Hades',
    ranking: [
      { place: 1, games: [{ name: 'Hades', rawgId: 3 }] },
      { place: 2, games: [{ name: 'Celeste, Deluxe' }] },
      { place: 3, games: [{ name: 'Portal' }, { name: 'Doom' }] },
    ],
    rounds: [
      { round: 1, eliminated: ['Portal', 'Doom'], firstLosses: [], byes: [], matches: [{ winner: 'Hades', loser: 'Portal' }, { winner: 'Celeste, Deluxe', loser: 'Doom' }] },
      { round: 2, eliminated: ['Celeste, Deluxe'], firstLosses: [], byes: [], matches: [{ winner: 'Hades', loser: 'Celeste, Deluxe' }] },
    ],
  })
})

test('CSV has one row per game and quotes commas', () => {
  expect(resultsToCsv(res, byId)).toBe('place,name,rawgId\n1,Hades,3\n2,"Celeste, Deluxe",\n3,Portal,\n3,Doom,\n')
})

test('share text lists the top three tiers with ties joined', () => {
  expect(shareText(res, byId, 'https://x.test/#s=1')).toBe(
    'My Swipie winner: Hades 🏆\n1. Hades\n2. Celeste, Deluxe\n3. Portal / Doom\nSwipe yours: https://x.test/#s=1',
  )
})
