export interface ImportEntry {
  name: string
  rawgId?: number
}

export class ImportError extends Error {}

export const SAMPLE_IMPORT = JSON.stringify(
  {
    version: 1,
    games: [
      'Hades',
      'Celeste',
      'Portal 2',
      'Hollow Knight',
      'Stardew Valley',
      'The Witcher 3: Wild Hunt',
      'Disco Elysium',
      'Outer Wilds',
    ].map((name) => ({ name })),
  },
  null,
  2,
)

function toEntry(item: unknown): ImportEntry {
  if (typeof item === 'string') return { name: item.trim() }
  if (item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string') {
    const { name, rawgId } = item as { name: string; rawgId?: unknown }
    return typeof rawgId === 'number' ? { name: name.trim(), rawgId } : { name: name.trim() }
  }
  throw new ImportError('Each game needs a "name"')
}

function parseJson(text: string): ImportEntry[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('That looks like JSON but could not be parsed')
  }
  const list = Array.isArray(data) ? data : (data as { games?: unknown } | null)?.games
  if (!Array.isArray(list)) throw new ImportError('Expected a "games" array or a JSON array of names')
  return list.map(toEntry)
}

function parseLines(text: string): ImportEntry[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((name) => ({ name }))
}

export function parseImport(text: string): ImportEntry[] {
  const trimmed = text.trim()
  const entries = /^[[{]/.test(trimmed) ? parseJson(trimmed) : parseLines(trimmed)
  const seen = new Set<string>()
  return entries.filter((e) => {
    const key = e.name.toLowerCase()
    if (!e.name || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
