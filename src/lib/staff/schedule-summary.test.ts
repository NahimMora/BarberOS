import { describe, expect, it } from 'vitest'
import { rangesOverlap, summarizeSchedule } from './schedule-summary'

describe('summarizeSchedule', () => {
  it('collapses consecutive weekdays sharing the exact same range', () => {
    const monToFri = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      startTime: '09:00',
      endTime: '19:00',
    }))
    expect(summarizeSchedule(monToFri)).toEqual(['Lun–Vie 09:00–19:00'])
  })

  it('keeps a different range on its own day', () => {
    const ranges = [
      { weekday: 1, startTime: '09:00', endTime: '19:00' },
      { weekday: 2, startTime: '09:00', endTime: '19:00' },
      { weekday: 6, startTime: '10:00', endTime: '14:00' },
    ]
    expect(summarizeSchedule(ranges)).toEqual(['Lun–Mar 09:00–19:00', 'Sáb 10:00–14:00'])
  })

  it('reports a single loose day on its own', () => {
    expect(summarizeSchedule([{ weekday: 2, startTime: '10:00', endTime: '15:00' }])).toEqual([
      'Mar 10:00–15:00',
    ])
  })

  it('returns an empty summary for a barber with no schedule', () => {
    expect(summarizeSchedule([])).toEqual([])
  })

  it('joins multiple ranges the same day (split shift) before comparing', () => {
    const splitShift = (weekday: number) => [
      { weekday, startTime: '09:00', endTime: '13:00' },
      { weekday, startTime: '14:00', endTime: '19:00' },
    ]
    const ranges = [...splitShift(1), ...splitShift(2)]
    expect(summarizeSchedule(ranges)).toEqual(['Lun–Mar 09:00–13:00, 14:00–19:00'])
  })

  it('wraps the week order starting Monday through Sunday', () => {
    const ranges = [
      { weekday: 0, startTime: '10:00', endTime: '14:00' },
      { weekday: 1, startTime: '09:00', endTime: '19:00' },
    ]
    expect(summarizeSchedule(ranges)).toEqual(['Lun 09:00–19:00', 'Dom 10:00–14:00'])
  })
})

describe('rangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(rangesOverlap({ startTime: '09:00', endTime: '13:00' }, { startTime: '12:00', endTime: '15:00' })).toBe(true)
  })

  it('allows back-to-back ranges that only touch at the boundary', () => {
    expect(rangesOverlap({ startTime: '09:00', endTime: '13:00' }, { startTime: '13:00', endTime: '18:00' })).toBe(false)
  })

  it('allows fully separate ranges', () => {
    expect(rangesOverlap({ startTime: '09:00', endTime: '12:00' }, { startTime: '14:00', endTime: '18:00' })).toBe(false)
  })

  it('detects one range fully containing another', () => {
    expect(rangesOverlap({ startTime: '09:00', endTime: '19:00' }, { startTime: '12:00', endTime: '13:00' })).toBe(true)
  })
})
