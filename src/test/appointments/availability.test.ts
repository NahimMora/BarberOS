import { describe, it, expect } from 'vitest'
import { validateBranchWorkingHours, AvailabilityError } from '@/lib/appointments/validate'

/**
 * Pure availability validation tests — no DB required.
 * Tests validateBranchWorkingHours and the schedule/time-off logic.
 */

function makeDate(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2025, 0, 15, hour, minute, 0)) // Wednesday
}

const branchWithHours = {
  workingHours: {
    wed: { open: '09:00', close: '18:00' },
  },
}

const branchClosed = {
  workingHours: {
    wed: null,
  },
}

const branchNoHours = {
  workingHours: null,
}

describe('validateBranchWorkingHours', () => {
  it('allows a slot within branch working hours', () => {
    expect(() =>
      validateBranchWorkingHours(branchWithHours, makeDate(10), makeDate(11)),
    ).not.toThrow()
  })

  it('allows a slot that exactly matches open/close', () => {
    expect(() =>
      validateBranchWorkingHours(branchWithHours, makeDate(9), makeDate(18)),
    ).not.toThrow()
  })

  it('rejects a slot that starts before branch opens', () => {
    expect(() =>
      validateBranchWorkingHours(branchWithHours, makeDate(8), makeDate(10)),
    ).toThrow(AvailabilityError)
  })

  it('rejects a slot that ends after branch closes', () => {
    expect(() =>
      validateBranchWorkingHours(branchWithHours, makeDate(17), makeDate(19)),
    ).toThrow(AvailabilityError)
  })

  it('rejects a slot when branch is closed that day (null)', () => {
    expect(() =>
      validateBranchWorkingHours(branchClosed, makeDate(10), makeDate(11)),
    ).toThrow(AvailabilityError)
  })

  it('allows any slot when branch has no working_hours (null)', () => {
    expect(() =>
      validateBranchWorkingHours(branchNoHours, makeDate(10), makeDate(11)),
    ).not.toThrow()
  })
})

describe('Barber time-off logic (unit)', () => {
  type TimeBlock = { startAt: Date; endAt: Date }

  function isBlockedByTimeOff(timeOff: TimeBlock[], slotStart: Date, slotEnd: Date): boolean {
    return timeOff.some(t => t.startAt < slotEnd && t.endAt > slotStart)
  }

  it('blocks a slot that falls within time-off period', () => {
    const timeOff = [{ startAt: makeDate(10), endAt: makeDate(12) }]
    expect(isBlockedByTimeOff(timeOff, makeDate(10), makeDate(11))).toBe(true)
  })

  it('blocks a slot that partially overlaps time-off', () => {
    const timeOff = [{ startAt: makeDate(11), endAt: makeDate(13) }]
    expect(isBlockedByTimeOff(timeOff, makeDate(10), makeDate(12))).toBe(true)
  })

  it('allows a slot before time-off', () => {
    const timeOff = [{ startAt: makeDate(14), endAt: makeDate(16) }]
    expect(isBlockedByTimeOff(timeOff, makeDate(10), makeDate(12))).toBe(false)
  })

  it('allows a slot after time-off', () => {
    const timeOff = [{ startAt: makeDate(9), endAt: makeDate(10) }]
    expect(isBlockedByTimeOff(timeOff, makeDate(10), makeDate(11))).toBe(false)
  })

  it('allows a slot when no time-off exists', () => {
    expect(isBlockedByTimeOff([], makeDate(10), makeDate(11))).toBe(false)
  })
})

describe('Barber schedule coverage logic (unit)', () => {
  type Schedule = { weekday: number; startTime: string; endTime: string; active: boolean }

  function toTimeString(date: Date): string {
    const h = date.getUTCHours().toString().padStart(2, '0')
    const m = date.getUTCMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  function isCoveredBySchedule(schedules: Schedule[], slotStart: Date, slotEnd: Date): boolean {
    const weekday = slotStart.getUTCDay()
    const startStr = toTimeString(slotStart)
    const endStr = toTimeString(slotEnd)
    return schedules.some(
      s =>
        s.active &&
        s.weekday === weekday &&
        s.startTime <= startStr &&
        s.endTime >= endStr,
    )
  }

  const schedule: Schedule = { weekday: 3, startTime: '09:00', endTime: '18:00', active: true } // Wednesday

  it('allows a slot within schedule', () => {
    expect(isCoveredBySchedule([schedule], makeDate(10), makeDate(11))).toBe(true)
  })

  it('rejects a slot before schedule starts', () => {
    expect(isCoveredBySchedule([schedule], makeDate(7), makeDate(9))).toBe(false)
  })

  it('rejects a slot after schedule ends', () => {
    expect(isCoveredBySchedule([schedule], makeDate(17), makeDate(19))).toBe(false)
  })

  it('rejects a slot when no matching schedule exists', () => {
    expect(isCoveredBySchedule([], makeDate(10), makeDate(11))).toBe(false)
  })

  it('rejects a slot when schedule is inactive', () => {
    const inactive = { ...schedule, active: false }
    expect(isCoveredBySchedule([inactive], makeDate(10), makeDate(11))).toBe(false)
  })

  it('rejects a slot on wrong weekday', () => {
    const mondaySchedule = { ...schedule, weekday: 1 }
    // makeDate is Wednesday (weekday 3)
    expect(isCoveredBySchedule([mondaySchedule], makeDate(10), makeDate(11))).toBe(false)
  })
})
