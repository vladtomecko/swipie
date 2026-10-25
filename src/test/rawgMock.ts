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
]

export const rawgHandlers = [
  http.get(`${RAWG}/games`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('search')?.toLowerCase() ?? ''
    return HttpResponse.json({ results: catalogue.filter((g) => g.name.toLowerCase().includes(q)) })
  }),
  http.get(`${RAWG}/games/:id`, ({ params }) => {
    const game = catalogue.find((g) => g.id === Number(params.id))
    return game ? HttpResponse.json(game) : new HttpResponse(null, { status: 404 })
  }),
]

export const server = setupServer(...rawgHandlers)
