import { estimateMinutes, estimatePicks, formatEstimate } from './estimate'

test('dropout needs exactly n-1 picks', () => {
  expect(estimatePicks(8, 'dropout')).toEqual({ min: 7, max: 7 })
})

test('double elimination needs 2n-2 to 2n-1 picks', () => {
  expect(estimatePicks(8, 'double-elimination')).toEqual({ min: 14, max: 15 })
})

test('minutes assume ~5 seconds per pick, rounded up, at least 1', () => {
  expect(estimateMinutes(1)).toBe(1)
  expect(estimateMinutes(12)).toBe(1)
  expect(estimateMinutes(13)).toBe(2)
  expect(estimateMinutes(120)).toBe(10)
})

test('formats a single count or a range', () => {
  expect(formatEstimate(8, 'dropout')).toBe('≈ 7 picks · about 1 min')
  expect(formatEstimate(8, 'double-elimination')).toBe('≈ 14–15 picks · about 2 min')
  expect(formatEstimate(2, 'dropout')).toBe('≈ 1 pick · about 1 min')
})
