import { decodeShare, encodeShare } from './shareLink'
import type { Swipie } from './swipie'

const game = (rawgId: number, name: string): Swipie => ({ id: `rawg:${rawgId}`, rawgId, name, query: name, status: 'resolved' })
const plain = (name: string): Swipie => ({ id: `q:${name.toLowerCase()}`, name, query: name, status: 'not-found' })

test('round-trips algorithm, RAWG ids and plain names', () => {
  const hash = encodeShare({ algorithm: 'double-elimination', swipies: [game(3498, 'GTA V'), plain('Weird, Game & Co'), game(1, 'Hades')] })
  expect(decodeShare(hash)).toEqual({
    algorithm: 'double-elimination',
    entries: [{ name: 'RAWG #3498', rawgId: 3498 }, { name: 'Weird, Game & Co' }, { name: 'RAWG #1', rawgId: 1 }],
  })
})

test('is compact: ids in base36, no per-game names', () => {
  const swipies = Array.from({ length: 100 }, (_, i) => game(100000 + i * 7919, `Some Long Game Title ${i}`))
  const hash = encodeShare({ algorithm: 'dropout', swipies })
  expect(hash.length).toBeLessThan(600)
  expect(hash).not.toContain('Some')
})

test('accepts a leading # and ignores unrelated hashes', () => {
  const hash = encodeShare({ algorithm: 'dropout', swipies: [game(10, 'A')] })
  expect(decodeShare(`#${hash}`)?.entries).toEqual([{ name: 'RAWG #10', rawgId: 10 }])
  expect(decodeShare('')).toBeNull()
  expect(decodeShare('#section-2')).toBeNull()
})

test('malformed share data is rejected or skipped safely', () => {
  expect(decodeShare('#s=1&a=dropout&g=')).toBeNull()
  expect(decodeShare('#s=1&a=bogus&g=a')?.algorithm).toBe('dropout')
  expect(decodeShare('#s=1&a=dropout&g=a,,~%E0%A4%A,!!')?.entries).toEqual([{ name: 'RAWG #10', rawgId: 10 }])
})

describe('isSameList', () => {
  test('ignores order and name placeholders for RAWG ids; compares algorithm', async () => {
    const { isSameList } = await import('./shareLink')
    const session = { algorithm: 'dropout' as const, swipies: [game(1, 'Hades'), plain('Mystery'), game(3, 'Celeste')] }
    const shared = decodeShare(encodeShare({ algorithm: 'dropout', swipies: [game(3, 'x'), game(1, 'y'), plain('mystery')] }))!
    expect(isSameList(shared, session)).toBe(true)
    expect(isSameList({ ...shared, algorithm: 'double-elimination' }, session)).toBe(false)
    expect(isSameList({ ...shared, entries: shared.entries.slice(1) }, session)).toBe(false)
  })
})

describe('ranking in share links', () => {
  const sw = (name: string, rawgId?: number): Swipie => ({ id: name, name, query: name, status: 'resolved', ...(rawgId ? { rawgId } : {}) })
  test('round-trips tiers with ids and names', () => {
    const [a, b, c] = [sw('A', 40), sw('B c'), sw('C', 7)]
    const hash = encodeShare({ algorithm: 'dropout', swipies: [a, b, c], ranking: [[a], [b, c]] })
    expect(hash).toBe('s=1&a=dropout&g=14,~B%20c,7&r=14.~B%20c+7')
    expect(decodeShare(`#${hash}`)?.ranking).toEqual([[{ name: 'RAWG #40', rawgId: 40 }], [{ name: 'B c' }, { name: 'RAWG #7', rawgId: 7 }]])
  })
  test('ranking is absent without r=', () => {
    expect(decodeShare('#s=1&a=dropout&g=~A')).toEqual({ algorithm: 'dropout', entries: [{ name: 'A' }] })
  })
})
