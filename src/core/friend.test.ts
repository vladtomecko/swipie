import { compareRankings, loadFriend, saveFriend, type FriendResult } from './friend'
import type { Swipie } from './swipie'

const sw = (id: string, name: string, rawgId?: number): Swipie => ({ id, name, query: name, status: 'resolved', ...(rawgId ? { rawgId } : {}) })
const games: Record<string, Swipie> = { a: sw('a', 'Hades', 3), b: sw('b', 'Celeste'), c: sw('c', 'Portal'), d: sw('d', 'Doom') }
const byId = (id: string) => games[id]
const mine = [
  { place: 1, ids: ['a'] },
  { place: 2, ids: ['b'] },
  { place: 3, ids: ['c', 'd'] },
]
const friend = (ranking: FriendResult['ranking']): FriendResult => ({ algorithm: 'dropout', entries: ranking.flat(), ranking })

test('matches by RAWG id or lowercase name, ignores unknown games', () => {
  const c = compareRankings(mine, byId, friend([[{ name: 'RAWG #3', rawgId: 3 }], [{ name: 'Unknown' }], [{ name: 'doom' }], [{ name: 'CELESTE' }, { name: 'portal' }]]))
  expect(c.rows).toEqual([
    { id: 'a', name: 'Hades', mine: 1, theirs: 1 },
    { id: 'b', name: 'Celeste', mine: 2, theirs: 3 },
    { id: 'd', name: 'Doom', mine: 3, theirs: 2 },
    { id: 'c', name: 'Portal', mine: 3, theirs: 3 },
  ])
  expect(c.sameWinner).toBe(true)
  expect(c.agreement).toBe(100)
})

test('reports different winners and partial agreement', () => {
  const c = compareRankings(mine, byId, friend([[{ name: 'Doom' }], [{ name: 'Portal' }], [{ name: 'Celeste' }], [{ name: 'Hades' }]]))
  expect(c).toMatchObject({ sameWinner: false, myWinner: 'Hades', theirWinner: 'Doom', agreement: 50 })
})

test('persists and clears', () => {
  const f = friend([[{ name: 'Doom' }]])
  saveFriend(localStorage, f)
  expect(loadFriend(localStorage)).toEqual(f)
  saveFriend(localStorage, null)
  expect(loadFriend(localStorage)).toBeNull()
})
