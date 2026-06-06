import { describe, expect, it } from 'vitest'
import {
  getLocalCalendarDate,
  getLocalCalendarMonth,
  getLocalDayUtcRange,
  getLocalMonthUtcRange,
} from '@/lib/datetime/local-day-range'

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

describe('getLocalMonthUtcRange', () => {
  it('converts a Buenos Aires calendar month to an exclusive UTC range', () => {
    const range = getLocalMonthUtcRange(
      '2026-06',
      'America/Argentina/Buenos_Aires',
    )

    expect(range.start.toISOString()).toBe('2026-06-01T03:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-07-01T03:00:00.000Z')
  })

  it('rejects invalid months', () => {
    expect(() => getLocalMonthUtcRange('2026-13', 'UTC')).toThrow(RangeError)
  })
})

describe('local calendar labels', () => {
  it('uses the organization timezone around UTC boundaries', () => {
    const instant = new Date('2026-07-01T01:30:00.000Z')

    expect(getLocalCalendarDate(instant, 'America/Argentina/Buenos_Aires')).toBe('2026-06-30')
    expect(getLocalCalendarMonth(instant, 'America/Argentina/Buenos_Aires')).toBe('2026-06')
  })
})
