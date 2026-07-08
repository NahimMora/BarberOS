import { describe, expect, it } from 'vitest'
import {
  getLocalCalendarDate,
  getLocalCalendarMonth,
  getLocalDayUtcRange,
  getLocalMonthUtcRange,
} from './local-day-range'

const TZ = 'America/Argentina/Buenos_Aires' // fixed UTC-3, no DST

describe('getLocalMonthUtcRange', () => {
  it('starts exactly at local midnight of the first day', () => {
    const range = getLocalMonthUtcRange('2026-02', TZ)
    expect(range.start.toISOString()).toBe('2026-02-01T03:00:00.000Z')
  })

  it('ends exactly at local midnight of the first day of the next month', () => {
    const range = getLocalMonthUtcRange('2026-02', TZ)
    expect(range.end.toISOString()).toBe('2026-03-01T03:00:00.000Z')
  })

  it('excludes the last instant of the previous month at the boundary', () => {
    const range = getLocalMonthUtcRange('2026-02', TZ)
    const lastInstantOfJanuary = new Date(range.start.getTime() - 1)
    expect(lastInstantOfJanuary < range.start).toBe(true)
    // 2026-01-31 23:59:59.999 local time, not February
    expect(lastInstantOfJanuary.toISOString()).toBe('2026-02-01T02:59:59.999Z')
  })

  it('includes the first instant of the month and excludes the first instant of the next', () => {
    const range = getLocalMonthUtcRange('2026-02', TZ)
    expect(range.start >= range.start && range.start < range.end).toBe(true)
    expect(range.end < range.end).toBe(false)
  })

  it('spans a full 29-day February on a leap year', () => {
    const range = getLocalMonthUtcRange('2028-02', TZ)
    const days = (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)
    expect(days).toBe(29)
  })

  it('spans a 28-day February on a non-leap year', () => {
    const range = getLocalMonthUtcRange('2026-02', TZ)
    const days = (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)
    expect(days).toBe(28)
  })

  it('rolls over correctly from December to January', () => {
    const range = getLocalMonthUtcRange('2026-12', TZ)
    expect(range.end.toISOString()).toBe('2027-01-01T03:00:00.000Z')
  })

  it('rejects an invalid month', () => {
    expect(() => getLocalMonthUtcRange('2026-13', TZ)).toThrow(RangeError)
    expect(() => getLocalMonthUtcRange('2026-00', TZ)).toThrow(RangeError)
  })
})

describe('getLocalDayUtcRange', () => {
  it('covers exactly 24 hours from local midnight to the next', () => {
    const range = getLocalDayUtcRange('2026-02-15', TZ)
    expect(range.start.toISOString()).toBe('2026-02-15T03:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-02-16T03:00:00.000Z')
  })

  it('rolls over correctly at the last day of a month', () => {
    const range = getLocalDayUtcRange('2026-02-28', TZ)
    expect(range.end.toISOString()).toBe('2026-03-01T03:00:00.000Z')
  })

  it('accepts February 29 on a leap year', () => {
    const range = getLocalDayUtcRange('2028-02-29', TZ)
    expect(range.start.toISOString()).toBe('2028-02-29T03:00:00.000Z')
    expect(range.end.toISOString()).toBe('2028-03-01T03:00:00.000Z')
  })

  it('rejects February 29 on a non-leap year', () => {
    expect(() => getLocalDayUtcRange('2026-02-29', TZ)).toThrow(RangeError)
  })

  it('rejects an invalid date', () => {
    expect(() => getLocalDayUtcRange('2026-04-31', TZ)).toThrow(RangeError)
  })
})

describe('getLocalCalendarDate / getLocalCalendarMonth', () => {
  it('resolves a UTC instant just after midnight to the previous local calendar day', () => {
    // 2026-01-01T02:00:00Z is still 2025-12-31 23:00 in Buenos Aires (UTC-3)
    const instant = new Date('2026-01-01T02:00:00.000Z')
    expect(getLocalCalendarDate(instant, TZ)).toBe('2025-12-31')
    expect(getLocalCalendarMonth(instant, TZ)).toBe('2025-12')
  })

  it('resolves a UTC instant at the local month boundary correctly', () => {
    const instant = new Date('2026-02-01T03:00:00.000Z')
    expect(getLocalCalendarDate(instant, TZ)).toBe('2026-02-01')
    expect(getLocalCalendarMonth(instant, TZ)).toBe('2026-02')
  })
})
