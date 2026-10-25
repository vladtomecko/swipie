import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { offlineSource } from './sources/source'
import { createRawgSource } from './sources/rawg'
import { server } from './test/rawgMock'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const rawg = createRawgSource('k')

function setup(source = offlineSource) {
  const user = userEvent.setup()
  const utils = render(<App source={source} seed={() => 7} />)
  return { user, ...utils }
}

const gameList = () => screen.getByRole('list', { name: /games/i })
const gameNames = () => within(gameList()).queryAllByRole('listitem').map((li) => li.dataset.name)

async function pasteGames(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('textbox', { name: /paste/i }))
  await user.paste(text)
  await user.click(screen.getByRole('button', { name: /add pasted/i }))
}

describe('import page', () => {
  test('renders with start disabled until there are two games', async () => {
    const { user } = setup()
    expect(screen.getByRole('heading', { name: /swipie/i })).toBeInTheDocument()
    const start = screen.getByRole('button', { name: /start swiping/i })
    expect(start).toBeDisabled()
    await pasteGames(user, 'Hades')
    expect(start).toBeDisabled()
    await pasteGames(user, 'Celeste')
    expect(start).toBeEnabled()
  })

  test('pasted multi-line text is added alphabetically and the box clears', async () => {
    const { user } = setup()
    await pasteGames(user, 'Portal 2\nCeleste\n\nHades')
    expect(gameNames()).toEqual(['Celeste', 'Hades', 'Portal 2'])
    expect(screen.getByRole('textbox', { name: /paste/i })).toHaveValue('')
  })

  test('pasted JSON is accepted too', async () => {
    const { user } = setup()
    await pasteGames(user, '["Hades","Celeste"]')
    expect(gameNames()).toEqual(['Celeste', 'Hades'])
  })

  test('uploading a .txt file with one name per line', async () => {
    const { user } = setup()
    const file = new File(['Hades\nCeleste\n'], 'games.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText(/import file/i), file)
    await waitFor(() => expect(gameNames()).toEqual(['Celeste', 'Hades']))
  })

  test('uploading a JSON file', async () => {
    const { user } = setup()
    const file = new File(['{"version":1,"games":[{"name":"Outer Wilds"}]}'], 'g.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/import file/i), file)
    await waitFor(() => expect(gameNames()).toEqual(['Outer Wilds']))
  })

  test('invalid JSON shows an error', async () => {
    const { user } = setup()
    await pasteGames(user, '{"games": [')
    expect(screen.getByRole('alert')).toHaveTextContent(/json/i)
  })

  test('sample JSON is downloadable and parseable', () => {
    setup()
    const link = screen.getByRole('link', { name: /sample/i })
    expect(link).toHaveAttribute('download', 'swipie-sample.json')
    const json = decodeURIComponent(link.getAttribute('href')!.replace(/^data:application\/json[^,]*,/, ''))
    expect(JSON.parse(json).games.length).toBeGreaterThanOrEqual(8)
  })

  test('removing a game and clearing all', async () => {
    const { user } = setup()
    await pasteGames(user, 'A\nB\nC')
    await user.click(screen.getByRole('button', { name: 'Remove B' }))
    expect(gameNames()).toEqual(['A', 'C'])
    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(gameNames()).toEqual([])
  })

  test('offline mode explains that RAWG is not configured', () => {
    setup()
    expect(screen.getByText(/rawg.*not configured/i)).toBeInTheDocument()
  })
})

describe('import page with RAWG', () => {
  test('search suggests games; choosing one adds it and confirms', async () => {
    const { user } = setup(rawg)
    await user.type(screen.getByRole('combobox', { name: /search games/i }), 'hade')
    const option = await screen.findByRole('option', { name: /^Hades II/ })
    await user.click(option)
    expect(screen.getByRole('status')).toHaveTextContent(/added hades ii/i)
    expect(gameNames()).toEqual(['Hades II'])
    expect(screen.queryByText(/from "/)).not.toBeInTheDocument()
    expect(within(gameList()).getByRole('img', { name: 'Hades II' })).toHaveAttribute('src', 'https://media.rawg.io/2.jpg')
  })

  test('suggestions mark games already in the list', async () => {
    const { user } = setup(rawg)
    await pasteGames(user, 'Celeste')
    await waitFor(() => expect(within(gameList()).getByRole('img', { name: 'Celeste' })).toBeInTheDocument())
    await user.type(screen.getByRole('combobox', { name: /search games/i }), 'celes')
    expect(await screen.findByRole('option', { name: /Celeste.*added/i })).toBeInTheDocument()
  })

  test('imported names resolve to RAWG matches, unknown ones are flagged', async () => {
    const { user } = setup(rawg)
    await pasteGames(user, 'portal\nTotally Unknown Game')
    await waitFor(() => expect(gameNames()).toEqual(['Portal 2', 'Totally Unknown Game']))
    expect(screen.getByText(/from "portal"/i)).toBeInTheDocument()
    const unknown = within(gameList()).getAllByRole('listitem')[1]
    expect(unknown).toHaveTextContent(/not found/i)
  })

  test('change replaces a match with another search result', async () => {
    const { user } = setup(rawg)
    await pasteGames(user, 'doom')
    await waitFor(() => expect(gameNames()).toEqual(['DOOM']))
    await user.click(screen.getByRole('button', { name: 'Change DOOM' }))
    const option = await screen.findByRole('option', { name: /DOOM \(1993\)/ })
    await user.click(option)
    expect(gameNames()).toEqual(['DOOM (1993)'])
  })
})

async function startWith(names: string, algorithm?: RegExp) {
  const utils = setup()
  await pasteGames(utils.user, names)
  if (algorithm) await utils.user.click(screen.getByRole('radio', { name: algorithm }))
  await utils.user.click(screen.getByRole('button', { name: /start swiping/i }))
  return utils
}

const matchCards = () => screen.getAllByRole('button', { name: /^pick /i })

describe('swipe page', () => {
  test('shows two games and progress', async () => {
    await startWith('A\nB\nC\nD')
    expect(matchCards()).toHaveLength(2)
    expect(screen.getByText(/round 1/i)).toBeInTheDocument()
    expect(screen.getByText(/match 1 of 2/i)).toBeInTheDocument()
  })

  test('arrow keys pick left and right', async () => {
    const { user } = await startWith('A\nB\nC\nD')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText(/match 2 of 2/i)).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText(/round 2/i)).toBeInTheDocument()
  })

  test('tapping a card picks it', async () => {
    const { user } = await startWith('A\nB\nC\nD')
    await user.click(matchCards()[1])
    expect(screen.getByText(/match 2 of 2/i)).toBeInTheDocument()
  })

  test('dragging right past the threshold picks the right card', async () => {
    await startWith('A\nB\nC\nD')
    const stage = screen.getByTestId('swipe-stage')
    fireEvent.pointerDown(stage, { clientX: 200, pointerId: 1 })
    fireEvent.pointerMove(stage, { clientX: 400, pointerId: 1 })
    fireEvent.pointerUp(stage, { clientX: 400, pointerId: 1 })
    expect(screen.getByText(/match 2 of 2/i)).toBeInTheDocument()
  })

  test('a short drag does not pick', async () => {
    await startWith('A\nB\nC\nD')
    const stage = screen.getByTestId('swipe-stage')
    fireEvent.pointerDown(stage, { clientX: 200, pointerId: 1 })
    fireEvent.pointerUp(stage, { clientX: 220, pointerId: 1 })
    expect(screen.getByText(/match 1 of 2/i)).toBeInTheDocument()
  })

  test('undo via button and keyboard', async () => {
    const { user } = await startWith('A\nB\nC\nD')
    const undo = screen.getByRole('button', { name: /undo/i })
    expect(undo).toBeDisabled()
    await user.keyboard('{ArrowLeft}')
    await user.click(undo)
    expect(screen.getByText(/match 1 of 2/i)).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    await user.keyboard('z')
    expect(screen.getByText(/match 1 of 2/i)).toBeInTheDocument()
  })

  test('progress survives a reload', async () => {
    const { user, unmount } = await startWith('A\nB\nC\nD')
    await user.keyboard('{ArrowLeft}')
    unmount()
    setup()
    expect(screen.getByText(/match 2 of 2/i)).toBeInTheDocument()
  })
})

describe('results page', () => {
  async function finish(names: string, algorithm?: RegExp) {
    const utils = await startWith(names, algorithm)
    while (screen.queryByTestId('swipe-stage')) {
      const left = matchCards()[0].dataset.id!
      const right = matchCards()[1].dataset.id!
      await utils.user.keyboard(left < right ? '{ArrowLeft}' : '{ArrowRight}')
    }
    return utils
  }

  test('dropout: winner, timeline and ranking', async () => {
    await finish('A\nB\nC\nD')
    expect(screen.getByRole('heading', { name: /winner/i })).toBeInTheDocument()
    expect(screen.getByTestId('winner')).toHaveTextContent('A')
    const timeline = screen.getByRole('region', { name: /timeline/i })
    expect(within(timeline).getAllByRole('heading', { name: /round \d/i })).toHaveLength(2)
    expect(within(timeline).getAllByText(/beaten by/i)).toHaveLength(3)
    const ranking = screen.getByRole('region', { name: /ranking/i })
    expect(within(ranking).getAllByRole('listitem')).toHaveLength(3)
  })

  test('double elimination shows first losses as well', async () => {
    await finish('A\nB\nC', /double/i)
    expect(screen.getByTestId('winner')).toHaveTextContent('A')
    expect(screen.getAllByText(/first loss/i).length).toBeGreaterThan(0)
  })

  test('new tournament keeps the list; rematch restarts swiping', async () => {
    const { user } = await finish('A\nB')
    await user.click(screen.getByRole('button', { name: /rematch/i }))
    expect(screen.getByTestId('swipe-stage')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    await user.click(screen.getByRole('button', { name: /new tournament/i }))
    expect(gameNames()).toEqual(['A', 'B'])
  })
})

describe('share links', () => {
  afterEach(() => {
    history.replaceState(null, '', '/')
    vi.restoreAllMocks()
  })

  test('copy share link puts a compact URL with RAWG ids on the clipboard', async () => {
    const { user } = setup(rawg)
    const share = screen.getByRole('button', { name: /copy share link/i })
    expect(share).toBeDisabled()
    await pasteGames(user, 'celeste\nhades\nMystery Game')
    await waitFor(() => expect(within(gameList()).getAllByRole('img')).toHaveLength(2))
    await user.click(screen.getByRole('radio', { name: /double/i }))
    await user.click(share)
    const url = await navigator.clipboard.readText()
    expect(url).toMatch(/#s=1&a=double-elimination&g=/)
    expect(url).not.toMatch(/celeste/i)
    expect(screen.getByRole('status')).toHaveTextContent(/link copied/i)
    expect(screen.getByRole('textbox', { name: /share link/i })).toHaveValue(url)
  })

  test('opening a share link loads and resolves the games, then clears the hash', async () => {
    history.replaceState(null, '', '/#s=1&a=double-elimination&g=1,3,~Mystery%20Game')
    setup(rawg)
    await waitFor(() => expect(gameNames()).toEqual(['Celeste', 'Hades', 'Mystery Game']))
    expect(screen.getByRole('radio', { name: /double/i })).toBeChecked()
    expect(window.location.hash).toBe('')
    expect(screen.queryByText(/from "/)).not.toBeInTheDocument()
  })

  test('asks before replacing an existing list, and keeps it when declined', async () => {
    const { user, unmount } = setup()
    await pasteGames(user, 'Mine')
    unmount()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    history.replaceState(null, '', '/#s=1&a=dropout&g=~Theirs')
    setup()
    expect(confirm).toHaveBeenCalledOnce()
    expect(gameNames()).toEqual(['Mine'])
    expect(window.location.hash).toBe('')
  })

  test('replaces the existing list when confirmed', async () => {
    const { user, unmount } = setup()
    await pasteGames(user, 'Mine')
    unmount()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    history.replaceState(null, '', '/#s=1&a=dropout&g=~Theirs')
    setup()
    await waitFor(() => expect(gameNames()).toEqual(['Theirs']))
  })
})
