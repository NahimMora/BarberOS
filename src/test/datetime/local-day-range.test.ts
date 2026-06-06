import { describe, expect, it } from 'vitest'
import { getLocalDayUtcRange } from '@/lib/datetime/local-day-range'

describe('getLocalDayUtcRange', () => {
  it('converts a Buenos Aires calendar day to an exclusive UTC range', () => {
    const range = getLocalDayUtcRange(
      '2026-06-06',
      'America/Argentina/Buenos_Aires',
    )

    expect(range.start.toISOString()).toBe('2026-06-06T03:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-06-07T03:00:00.000Z')
  })
})
