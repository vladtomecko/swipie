import { http, HttpResponse } from 'msw'
import { RAWG, rawgGame, server } from '../test/rawgMock'
import { offlineSource } from './source'
import { createRawgSource } from './rawg'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const source = createRawgSource('test-key')

test('search maps RAWG results to swipies', async () => {
  const results = await source.search('hades')
  expect(results.map((s) => s.name)).toEqual(['Hades', 'Hades II'])
  expect(results[0]).toMatchObject({
    id: 'rawg:1',
    rawgId: 1,
    status: 'resolved',
    image: 'https://media.rawg.io/1.jpg',
    rating: 4.4,
    metacritic: 93,
    link: 'https://rawg.io/games/hades',
    stores: [{ name: 'Steam', url: 'https://store.steampowered.com/search/?term=Hades' }],
  })
})

test('search sends the api key', async () => {
  let key: string | null = null
  server.use(
    http.get(`${RAWG}/games`, ({ request }) => {
      key = new URL(request.url).searchParams.get('key')
      return HttpResponse.json({ results: [] })
    }),
  )
  await source.search('x')
  expect(key).toBe('test-key')
})

test('resolve takes the top hit and remembers the original query', async () => {
  expect(await source.resolve({ name: 'celeste' })).toMatchObject({ id: 'rawg:3', name: 'Celeste', query: 'celeste' })
})

test('resolve by rawgId fetches the game directly', async () => {
  expect(await source.resolve({ name: 'RAWG #4', rawgId: 4 })).toMatchObject({ id: 'rawg:4', name: 'Portal 2', query: 'Portal 2' })
})

test('resolve with no hits marks not-found but keeps the name', async () => {
  expect(await source.resolve({ name: 'Nope Game' })).toEqual({
    id: 'q:nope game',
    name: 'Nope Game',
    query: 'Nope Game',
    status: 'not-found',
  })
})

test('resolve on network/server error marks not-found instead of throwing', async () => {
  server.use(http.get(`${RAWG}/games`, () => new HttpResponse(null, { status: 500 })))
  expect((await source.resolve({ name: 'Hades' })).status).toBe('not-found')
})

test('search errors propagate so the UI can show them', async () => {
  server.use(http.get(`${RAWG}/games`, () => new HttpResponse(null, { status: 500 })))
  await expect(source.search('hades')).rejects.toThrow()
})

describe('searchAll', () => {
  test('asks RAWG for precise base games only, 40 per page', async () => {
    const seen: URLSearchParams[] = []
    server.use(
      http.get(`${RAWG}/games`, ({ request }) => {
        seen.push(new URL(request.url).searchParams)
        return HttpResponse.json({ next: null, results: [] })
      }),
    )
    await source.searchAll('total war')
    expect(seen).toHaveLength(1)
    expect(Object.fromEntries(seen[0])).toMatchObject({
      key: 'test-key',
      search: 'total war',
      search_precise: 'true',
      exclude_additions: 'true',
      page_size: '40',
      page: '1',
    })
  })

  test('drops DLC and maps ratings count and tba', async () => {
    const results = await source.searchAll('total war')
    const names = results.map((s) => s.name)
    expect(names).toContain('Total War: ROME II')
    expect(names).not.toContain('Total War: SHOGUN 2 - Fall of the Samurai')
    expect(results.find((s) => s.rawgId === 16)).toMatchObject({ ratingsCount: 4, query: 'total war' })
    expect(results.find((s) => s.rawgId === 14)).toMatchObject({ tba: true })
    expect(results.find((s) => s.rawgId === 11)).not.toHaveProperty('tba')
  })

  test('follows pages until next is null, at most three', async () => {
    const pages: string[] = []
    const page = (p: number) => Array.from({ length: 40 }, (_, i) => rawgGame(p * 100 + i, `Game ${p}-${i}`))
    server.use(
      http.get(`${RAWG}/games`, ({ request }) => {
        const p = Number(new URL(request.url).searchParams.get('page'))
        pages.push(String(p))
        return HttpResponse.json({ next: `${RAWG}/games?page=${p + 1}`, results: page(p) })
      }),
    )
    expect(await source.searchAll('game')).toHaveLength(120)
    expect(pages).toEqual(['1', '2', '3'])

    pages.length = 0
    server.use(
      http.get(`${RAWG}/games`, ({ request }) => {
        const p = Number(new URL(request.url).searchParams.get('page'))
        pages.push(String(p))
        return HttpResponse.json({ next: p < 2 ? `${RAWG}/games?page=${p + 1}` : null, results: page(p) })
      }),
    )
    expect(await source.searchAll('game')).toHaveLength(80)
    expect(pages).toEqual(['1', '2'])
  })

  test('errors propagate', async () => {
    server.use(http.get(`${RAWG}/games`, () => new HttpResponse(null, { status: 500 })))
    await expect(source.searchAll('total war')).rejects.toThrow()
  })
})

test('offline source finds nothing in bulk', async () => {
  expect(await offlineSource.searchAll('total war')).toEqual([])
})
