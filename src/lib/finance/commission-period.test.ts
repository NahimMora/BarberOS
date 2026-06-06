import { describe, expect, it } from 'vitest'
import { getCommissionPeriod } from './commission-period'

describe('getCommissionPeriod', () => {
  it('uses the organization timezone at UTC month boundaries', () => {
    const date = new Date('2026-07-01T01:30:00.000Z')
    expect(getCommissionPeriod(date, 'America/Argentina/Buenos_Aires')).toBe('2026-06')
    expect(getCommissionPeriod(date, 'UTC')).toBe('2026-07')
  })
})
