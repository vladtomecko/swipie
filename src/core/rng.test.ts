import { createRng, shuffle } from './rng'

test('same seed yields the same sequence', () => {
  const a = createRng(42)
  const b = createRng(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})

test('different seeds yield different sequences', () => {
  expect(createRng(1)()).not.toEqual(createRng(2)())
})

test('values are in [0, 1)', () => {
  const rng = createRng(7)
  for (let i = 0; i < 1000; i++) {
    const v = rng()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  }
})

test('shuffle is a deterministic permutation that does not mutate input', () => {
  const input = ['a', 'b', 'c', 'd', 'e', 'f']
  const out1 = shuffle(input, createRng(3))
  const out2 = shuffle(input, createRng(3))
  expect(out1).toEqual(out2)
  expect([...out1].sort()).toEqual(input)
  expect(input).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
})
