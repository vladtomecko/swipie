import { applyBatchView, batchCandidates, DEFAULT_BATCH_VIEW, matchesAllWords, platformOptions, type BatchView } from './batchFilter'
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

  test('preselects every game not already in the list', () => {
    const out = run('total war', [game(1, 'Total War: Popular'), game(2, 'Total War: Obscure', { ratingsCount: 2 })])
    expect(out.map((c) => c.selected)).toEqual([true, true])
  })

  test('games already in the list are marked added and never selected', () => {
    const out = run('total war', [game(1, 'Total War: ROME II'), game(2, 'Total War: ATTILA')], (s) => s.rawgId === 1)
    expect(out.find((c) => c.swipie.rawgId === 1)).toMatchObject({ added: true, selected: false })
    expect(out.find((c) => c.swipie.rawgId === 2)).toMatchObject({ added: false, selected: true })
  })
})

describe('applyBatchView', () => {
  const pool = run('total war', [
    game(1, 'Total War: Shogun 2', { released: '2011-03-15', owners: 9000, rating: 4.2, ratingsCount: 800, metacritic: 90, platforms: ['PC'] }),
    game(2, 'Total War: Rome II', { released: '2013-09-03', owners: 12000, rating: 3.6, ratingsCount: 900, metacritic: 76, platforms: ['PC', 'Apple Macintosh'] }),
    game(3, 'Total War: Warhammer', { released: '2016-05-24', owners: 7000, rating: 4.4, ratingsCount: 600, platforms: ['PC'] }),
    game(4, 'Total War: Arena', { released: '2018-02-22', owners: 300, ratingsCount: 4, platforms: ['PC'] }),
    game(5, 'Total War: Medieval', { released: '2002-08-19', owners: 2000, rating: 4.0, ratingsCount: 200, platforms: ['PlayStation'] }),
  ])
  const names = (view: Partial<BatchView>) => applyBatchView(pool, { ...DEFAULT_BATCH_VIEW, ...view }).map((c) => c.swipie.name.replace('Total War: ', ''))

  test('default: oldest first, games under 10 ratings hidden', () => {
    expect(names({})).toEqual(['Medieval', 'Shogun 2', 'Rome II', 'Warhammer'])
  })

  test('sorts: newest, most popular, best rated (unrated last), metacritic (unscored last)', () => {
    expect(names({ sort: 'released-desc' })).toEqual(['Warhammer', 'Rome II', 'Shogun 2', 'Medieval'])
    expect(names({ sort: 'popular' })).toEqual(['Rome II', 'Shogun 2', 'Warhammer', 'Medieval'])
    expect(names({ sort: 'rating', minRatings: 0 })).toEqual(['Warhammer', 'Shogun 2', 'Medieval', 'Rome II', 'Arena'])
    expect(names({ sort: 'metacritic' })).toEqual(['Shogun 2', 'Rome II', 'Medieval', 'Warhammer'])
  })

  test('year range is inclusive and either end is optional', () => {
    expect(names({ yearFrom: 2011, yearTo: 2013 })).toEqual(['Shogun 2', 'Rome II'])
    expect(names({ yearFrom: 2013 })).toEqual(['Rome II', 'Warhammer'])
    expect(names({ yearTo: 2010 })).toEqual(['Medieval'])
  })

  test('min ratings threshold', () => {
    expect(names({ minRatings: 0 })).toHaveLength(5)
    expect(names({ minRatings: 700 })).toEqual(['Shogun 2', 'Rome II'])
  })

  test('platform filter keeps games on any chosen platform', () => {
    expect(names({ platforms: ['PlayStation'] })).toEqual(['Medieval'])
    expect(names({ platforms: ['Apple Macintosh', 'PlayStation'] })).toEqual(['Medieval', 'Rome II'])
  })

  test('platform options list what the results offer, most common first', () => {
    expect(platformOptions(pool)).toEqual(['PC', 'Apple Macintosh', 'PlayStation'])
  })
})
