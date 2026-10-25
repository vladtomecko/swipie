import { ALGORITHMS, type AlgorithmId } from './tournament'

const SECONDS_PER_PICK = 5

export function estimatePicks(n: number, algorithm: AlgorithmId): { min: number; max: number } {
  const maxLosses = ALGORITHMS[algorithm].maxLosses
  const min = (n - 1) * maxLosses
  return { min, max: min + maxLosses - 1 }
}

export function estimateMinutes(picks: number): number {
  return Math.max(1, Math.ceil((picks * SECONDS_PER_PICK) / 60))
}

export function formatEstimate(n: number, algorithm: AlgorithmId): string {
  const { min, max } = estimatePicks(n, algorithm)
  const count = min === max ? `${min} pick${min === 1 ? '' : 's'}` : `${min}–${max} picks`
  return `≈ ${count} · about ${estimateMinutes(max)} min`
}
