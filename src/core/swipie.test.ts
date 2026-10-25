import { addSwipies, pendingSwipie, removeSwipie, replaceSwipie, type Swipie } from './swipie'

const resolved = (rawgId: number, name: string, query = name): Swipie => ({
  id: `rawg:${rawgId}`,
  rawgId,
  name,
  query,
  status: 'resolved',
})

test('pending swipie from a plain name gets a stable name-based id', () => {
  expect(pendingSwipie({ name: 'Hades' })).toEqual({ id: 'q:hades', name: 'Hades', query: 'Hades', status: 'pending' })
})

test('pending swipie with rawgId uses it as id', () => {
  expect(pendingSwipie({ name: 'Hades', rawgId: 1 }).id).toBe('rawg:1')
})

test('list is kept alphabetical, case-insensitive', () => {
  const list = addSwipies([], ['portal 2', 'Celeste', 'hades', 'Ape Out'].map((name) => pendingSwipie({ name })))
  expect(list.map((s) => s.name)).toEqual(['Ape Out', 'Celeste', 'hades', 'portal 2'])
})

test('adding skips duplicates by id or name', () => {
  let list = addSwipies([], [resolved(1, 'Hades')])
  list = addSwipies(list, [resolved(1, 'Hades again'), pendingSwipie({ name: 'HADES' })])
  expect(list).toHaveLength(1)
})

test('remove by id', () => {
  const list = addSwipies([], [pendingSwipie({ name: 'A' }), pendingSwipie({ name: 'B' })])
  expect(removeSwipie(list, 'q:a').map((s) => s.name)).toEqual(['B'])
})

test('replace keeps order alphabetical and drops the old entry if the new one is already present', () => {
  let list = addSwipies([], [pendingSwipie({ name: 'doom' }), pendingSwipie({ name: 'zelda' })])
  list = replaceSwipie(list, 'q:zelda', resolved(9, 'Breath of the Wild', 'zelda'))
  expect(list.map((s) => s.name)).toEqual(['Breath of the Wild', 'doom'])
  list = addSwipies(list, [resolved(2, 'DOOM (2016)')])
  list = replaceSwipie(list, 'q:doom', resolved(2, 'DOOM (2016)', 'doom'))
  expect(list.map((s) => s.id)).toEqual(['rawg:9', 'rawg:2'])
})

test('replace is ignored when the old entry was removed meanwhile', () => {
  const list = addSwipies([], [pendingSwipie({ name: 'A' })])
  expect(replaceSwipie(list, 'q:gone', resolved(1, 'Gone'))).toEqual(list)
})
