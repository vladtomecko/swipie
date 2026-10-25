import type { ImportEntry } from './importParser'
import { entryKey, type SharedList } from './shareLink'
import type { Swipie } from './swipie'
import type { RankTier, SwipieId } from './tournament'

export interface FriendResult extends SharedList {
  ranking: ImportEntry[][]
}

export interface CompareRow {
  id: SwipieId
  name: string
  mine: number
  theirs: number
}

export interface Comparison {
  rows: CompareRow[]
  sameWinner: boolean
  myWinner: string
  theirWinner: string
  agreement: number
}

// Friend places use competition ranking over the matched games only; agreement = % of games within one place.
export function compareRankings(mine: readonly RankTier[], byId: (id: SwipieId) => Swipie, friend: FriendResult): Comparison {
  const idByKey = new Map<string, SwipieId>()
  for (const tier of mine) for (const id of tier.ids) {
    const s = byId(id)
    idByKey.set(entryKey(s), id)
    idByKey.set(`n:${s.name.toLowerCase()}`, id)
  }
  const theirPlace = new Map<SwipieId, number>()
  let place = 1
  for (const tier of friend.ranking) {
    const ids = tier.map((e) => idByKey.get(entryKey(e))).filter((id): id is SwipieId => id !== undefined && !theirPlace.has(id))
    for (const id of ids) theirPlace.set(id, place)
    place += ids.length
  }
  const rows = mine.flatMap((t) => t.ids.filter((id) => theirPlace.has(id)).map((id) => ({ id, name: byId(id).name, mine: t.place, theirs: theirPlace.get(id)! }))).sort((x, y) => x.mine - y.mine || x.theirs - y.theirs)
  const winners = (pick: (r: CompareRow) => number) => rows.filter((r) => pick(r) === 1).map((r) => r.name)
  const myWinners = winners((r) => r.mine)
  const theirWinners = winners((r) => r.theirs)
  const close = rows.filter((r) => Math.abs(r.mine - r.theirs) <= 1).length
  return {
    rows,
    sameWinner: myWinners.length > 0 && myWinners.join() === theirWinners.join(),
    myWinner: myWinners.join(' / ') || '—',
    theirWinner: theirWinners.join(' / ') || '—',
    agreement: rows.length ? Math.round((close / rows.length) * 100) : 0,
  }
}

const FRIEND_KEY = 'swipie.friend.v1'

export function saveFriend(storage: Storage, friend: FriendResult | null) {
  try {
    if (friend) storage.setItem(FRIEND_KEY, JSON.stringify(friend))
    else storage.removeItem(FRIEND_KEY)
  } catch {
    // storage unavailable
  }
}

export function loadFriend(storage: Storage): FriendResult | null {
  try {
    const data = JSON.parse(storage.getItem(FRIEND_KEY) ?? 'null') as FriendResult | null
    return data && Array.isArray(data.entries) && Array.isArray(data.ranking) ? data : null
  } catch {
    return null
  }
}
