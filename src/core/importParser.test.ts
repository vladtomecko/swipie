import { parseImport, SAMPLE_IMPORT } from './importParser'

describe('parseImport', () => {
  test('versioned object form', () => {
    expect(parseImport('{"version":1,"games":[{"name":"Hades"},{"name":"Portal 2","rawgId":4200}]}')).toEqual([
      { name: 'Hades' },
      { name: 'Portal 2', rawgId: 4200 },
    ])
  })

  test('bare JSON array of strings', () => {
    expect(parseImport('["Hades", "Celeste"]')).toEqual([{ name: 'Hades' }, { name: 'Celeste' }])
  })

  test('bare JSON array of objects', () => {
    expect(parseImport('[{"name":"Hades"}]')).toEqual([{ name: 'Hades' }])
  })

  test('plain text: one name per line, trimmed, blanks and # comments skipped', () => {
    const text = '  Hades \n\n# favourites\nCeleste\r\nPortal 2\n   \n'
    expect(parseImport(text)).toEqual([{ name: 'Hades' }, { name: 'Celeste' }, { name: 'Portal 2' }])
  })

  test('duplicates (case-insensitive) are collapsed, first wins', () => {
    expect(parseImport('Hades\nhades\nHADES ')).toEqual([{ name: 'Hades' }])
  })

  test('a single plain name works', () => {
    expect(parseImport('Hades')).toEqual([{ name: 'Hades' }])
  })

  test('invalid JSON-looking input throws a readable error', () => {
    expect(() => parseImport('{"games": [')).toThrow(/json/i)
  })

  test('JSON with wrong shape throws', () => {
    expect(() => parseImport('{"foo": 1}')).toThrow(/games/i)
    expect(() => parseImport('[1, 2]')).toThrow()
    expect(() => parseImport('{"games":[{"title":"x"}]}')).toThrow(/name/i)
  })

  test('empty input yields an empty list', () => {
    expect(parseImport('   \n ')).toEqual([])
  })

  test('the sample round-trips through the parser', () => {
    const entries = parseImport(SAMPLE_IMPORT)
    expect(entries.length).toBeGreaterThanOrEqual(8)
  })
})
