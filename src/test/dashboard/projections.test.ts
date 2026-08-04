import { describe, it, expect } from 'vitest'
import { computeMonthRunRate, computeVariancePercent } from '@/lib/dashboard/projections'

describe('computeMonthRunRate', () => {
  it('projects a full 30-day month from 10 days of revenue', () => {
    expect(computeMonthRunRate('10000.00', 10, 30)).toBe('30000.00')
  })

  it('returns zero when no days have elapsed', () => {
    expect(computeMonthRunRate('500.00', 0, 30)).toBe('0.00')
  })

  it('returns zero for a non-numeric revenue value', () => {
    expect(computeMonthRunRate('not-a-number', 10, 30)).toBe('0.00')
  })

  it('handles the full month already elapsed (run-rate equals actual)', () => {
    expect(computeMonthRunRate('12345.67', 31, 31)).toBe('12345.67')
  })
})

describe('computeVariancePercent', () => {
  it('computes positive growth vs previous period', () => {
    expect(computeVariancePercent('1500.00', '1000.00')).toBeCloseTo(50, 5)
  })

  it('computes a decline vs previous period', () => {
    expect(computeVariancePercent('800.00', '1000.00')).toBeCloseTo(-20, 5)
  })

  it('returns null when the previous period is zero', () => {
    expect(computeVariancePercent('500.00', '0.00')).toBeNull()
  })

  it('returns null for a non-numeric previous value', () => {
    expect(computeVariancePercent('500.00', 'bad')).toBeNull()
  })
})
