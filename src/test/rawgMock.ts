import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const RAWG = 'https://api.rawg.io/api'

export const rawgGame = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  released: '2020-09-17',
  background_image: `https://media.rawg.io/${id}.jpg`,
  rating: 4.4,
  ratings_count: 500,
  metacritic: 93,
  stores: [{ store: { id: 1, name: 'Steam', slug: 'steam' } }],
  ...extra,
})

export const catalogue = [
  rawgGame(1, 'Hades'),
  rawgGame(2, 'Hades II'),
  rawgGame(3, 'Celeste'),
  rawgGame(4, 'Portal 2'),
  rawgGame(5, 'DOOM'),
  rawgGame(6, 'DOOM (1993)'),
  rawgGame(10, 'Total War: SHOGUN 2', { released: '2011-03-15' }),
  rawgGame(11, 'Total War: ROME II', { released: '2013-09-03' }),
  rawgGame(12, 'Total War: WARHAMMER', { released: '2016-05-24' }),
  rawgGame(13, 'Total War: SHOGUN 2 - Fall of the Samurai', { released: '2012-03-23', addition: true }),
  rawgGame(14, 'Total War: WARHAMMER 40,000', { released: null, tba: true }),
  rawgGame(15, 'Total War: Future', { released: '2099-01-01' }),
  rawgGame(16, 'Total War: ARENA', { released: '2018-02-22', ratings_count: 4 }),
  rawgGame(17, 'Total Annihilation', { released: '1997-09-30' }),
]

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)

export const rawgHandlers = [
  http.get(`${RAWG}/games`, ({ request }) => {
    const url = new URL(request.url)
    const params = url.searchParams
    const wanted = words(params.get('search') ?? '')
    const matches = catalogue.filter(
      (g) => wanted.some((w) => g.name.toLowerCase().includes(w)) && !(params.get('exclude_additions') === 'true' && 'addition' in g && g.addition),
    )
    const page = Number(params.get('page') ?? 1)
    const size = Number(params.get('page_size') ?? 20)
    const next = page * size < matches.length ? (url.searchParams.set('page', String(page + 1)), url.toString()) : null
    return HttpResponse.json({ count: matches.length, next, results: matches.slice((page - 1) * size, page * size) })
  }),
  http.get(`${RAWG}/games/:id`, ({ params }) => {
    const game = catalogue.find((g) => g.id === Number(params.id))
    return game ? HttpResponse.json(game) : new HttpResponse(null, { status: 404 })
  }),
]

export const server = setupServer(...rawgHandlers)
