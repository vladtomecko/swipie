import { batchCandidates, matchesAllWords } from './batchFilter'
import type { Swipie } from './swipie'

const game = (id: number, name: string, extra: Partial<Swipie> = {}): Swipie => ({
  id: `rawg:${id}`,
  rawgId: id,
  name,
  query: 'q',
  status: 'resolved',
  released: '2010-01-01',
  ratingsCount: 500,
  ...extra,
})

const today = '2026-10-25'
const run = (query: string, games: Swipie[], isAdded: (s: Swipie) => boolean = () => false) =>
  batchCandidates(games, { query, today, isAdded })

describe('matchesAllWords', () => {
  test('requires every query word, ignoring case and punctuation', () => {
    expect(matchesAllWords('Counter-Strike: Global Offensive', 'counter strike')).toBe(true)
    expect(matchesAllWords('Total War: ROME II', 'total war')).toBe(true)
    expect(matchesAllWords('Total Annihilation', 'total war')).toBe(false)
  })

  test('words match from their start, not anywhere inside', () => {
    expect(matchesAllWords('Warframe', 'warhammer')).toBe(false)
    expect(matchesAllWords('Star Wars', 'wars')).toBe(true)
    expect(matchesAllWords('Hades II', 'hade')).toBe(true)
    expect(matchesAllWords('Overwatch', 'watch')).toBe(false)
  })

  test('apostrophes do not split words', () => {
    expect(matchesAllWords("Assassin's Creed", 'assassins creed')).toBe(true)
  })

  test('a query with no words matches nothing', () => {
    expect(matchesAllWords('Anything', ' - ')).toBe(false)
  })
})

describe('batchCandidates', () => {
  test('keeps only titles containing all query words', () => {
    const out = run('total war', [game(1, 'Total War: SHOGUN 2'), game(2, 'Total Annihilation'), game(3, 'War Thunder')])
    expect(out.map((c) => c.swipie.name)).toEqual(['Total War: SHOGUN 2'])
  })

  test('drops unreleased games: no date, tba, or dated after today', () => {
    const out = run('total war', [
      game(1, 'Total War: ROME II', { released: '2013-09-03' }),
      game(2, 'Total War: Undated', { released: undefined }),
      game(3, 'Total War: TBA', { tba: true, released: '2026-01-01' }),
      game(4, 'Total War: Tomorrow', { released: '2026-10-26' }),
      game(5, 'Total War: Today', { released: today }),
    ])
    expect(out.map((c) => c.swipie.name)).toEqual(['Total War: ROME II', 'Total War: Today'])
  })

  test('sorts by release date ascending, then by name', () => {
    const out = run('total war', [
      game(1, 'Total War: WARHAMMER', { released: '2016-05-24' }),
      game(2, 'Total War: ROME II', { released: '2013-09-03' }),
      game(3, 'Total War: B', { released: '2000-01-01' }),
      game(4, 'Total War: A', { released: '2000-01-01' }),
    ])
    expect(out.map((c) => c.swipie.name)).toEqual(['Total War: A', 'Total War: B', 'Total War: ROME II', 'Total War: WARHAMMER'])
  })

  test('dedupes by id and by case-insensitive name', () => {
    const out = run('total war', [game(1, 'Total War: ROME II'), game(1, 'Total War: ROME II'), game(2, 'TOTAL WAR: rome ii')])
    expect(out).toHaveLength(1)
  })

  test('caps at 100 candidates', () => {
    const many = Array.from({ length: 130 }, (_, i) => game(i + 1, `Total War ${i + 1}`))
    expect(run('total war', many)).toHaveLength(100)
  })

  test('preselects games unless they have fewer than 10 ratings', () => {
    const out = run('total war', [
      game(1, 'Total War: Popular', { ratingsCount: 10 }),
      game(2, 'Total War: Obscure', { ratingsCount: 9 }),
      game(3, 'Total War: Unknown', { ratingsCount: undefined }),
    ])
    const selected = Object.fromEntries(out.map((c) => [c.swipie.name, c.selected]))
    expect(selected).toEqual({ 'Total War: Popular': true, 'Total War: Obscure': false, 'Total War: Unknown': false })
  })

  test('games already in the list are marked added and never selected', () => {
    const out = run('total war', [game(1, 'Total War: ROME II'), game(2, 'Total War: ATTILA')], (s) => s.rawgId === 1)
    expect(out.find((c) => c.swipie.rawgId === 1)).toMatchObject({ added: true, selected: false })
    expect(out.find((c) => c.swipie.rawgId === 2)).toMatchObject({ added: false, selected: true })
  })
})
