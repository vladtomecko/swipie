import { http, HttpResponse } from 'msw'
import { RAWG, server } from '../test/rawgMock'
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
  expect(await source.resolve({ name: 'whatever', rawgId: 4 })).toMatchObject({ id: 'rawg:4', name: 'Portal 2' })
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
