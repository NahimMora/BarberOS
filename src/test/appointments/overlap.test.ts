import { describe, it, expect } from 'vitest'

/**
 * Pure overlap logic tests — no DB required.
 * These mirror the SQL exclusion constraint logic and the validateNoOverlap function.
 *
 * Rule: two intervals overlap if start1 < end2 AND end1 > start2.
 * The constraint only applies to active statuses: scheduled, confirmed, in_progress.
 */

type Status = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

interface MockAppointment {
  barberId: string
  status: Status
  startAt: Date
  endAt: Date
}

const ACTIVE_STATUSES: Status[] = ['scheduled', 'confirmed', 'in_progress']

function overlaps(a: { startAt: Date; endAt: Date }, b: { startAt: Date; endAt: Date }): boolean {
  return a.startAt < b.endAt && a.endAt > b.startAt
}

function wouldOverlapActiveAppointments(
  existing: MockAppointment[],
  barberId: string,
  startAt: Date,
  endAt: Date,
  _excludeId?: string,
): boolean {
  return existing
    .filter(a => a.barberId === barberId && ACTIVE_STATUSES.includes(a.status))
    .some(a => overlaps(a, { startAt, endAt }))
}

const BARBER_A = 'barber-a'
const BARBER_B = 'barber-b'

function makeAppt(barberId: string, status: Status, startH: number, endH: number): MockAppointment {
  return {
    barberId,
    status,
    startAt: new Date(Date.UTC(2025, 0, 15, startH, 0, 0)),
    endAt: new Date(Date.UTC(2025, 0, 15, endH, 0, 0)),
  }
}

describe('Overlap detection logic', () => {
  describe('blocking cases (same barber, active status)', () => {
    it('blocks exact duplicate time', () => {
      const existing = [makeAppt(BARBER_A, 'scheduled', 10, 11)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
      )
      expect(result).toBe(true)
    })

    it('blocks partial overlap — new starts before existing ends', () => {
      const existing = [makeAppt(BARBER_A, 'confirmed', 10, 12)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 13, 0, 0)),
      )
      expect(result).toBe(true)
    })

    it('blocks partial overlap — new ends after existing starts', () => {
      const existing = [makeAppt(BARBER_A, 'confirmed', 11, 13)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 12, 0, 0)),
      )
      expect(result).toBe(true)
    })

    it('blocks new slot completely inside existing', () => {
      const existing = [makeAppt(BARBER_A, 'in_progress', 9, 13)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
      )
      expect(result).toBe(true)
    })
  })

  describe('non-blocking cases', () => {
    it('allows adjacent slot — end equals start of next', () => {
      const existing = [makeAppt(BARBER_A, 'scheduled', 10, 11)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 12, 0, 0)),
      )
      expect(result).toBe(false)
    })

    it('allows slot before existing', () => {
      const existing = [makeAppt(BARBER_A, 'scheduled', 12, 13)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 12, 0, 0)),
      )
      expect(result).toBe(false)
    })

    it('allows same time slot for different barber', () => {
      const existing = [makeAppt(BARBER_A, 'scheduled', 10, 11)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_B,
        new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
      )
      expect(result).toBe(false)
    })

    it('does not block if existing appointment is cancelled', () => {
      const existing = [makeAppt(BARBER_A, 'cancelled', 10, 11)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
      )
      expect(result).toBe(false)
    })

    it('does not block if existing appointment is no_show', () => {
      const existing = [makeAppt(BARBER_A, 'no_show', 10, 11)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
      )
      expect(result).toBe(false)
    })

    it('does not block if existing appointment is completed', () => {
      const existing = [makeAppt(BARBER_A, 'completed', 10, 11)]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
      )
      expect(result).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles multiple existing appointments — at least one overlaps → blocked', () => {
      const existing = [
        makeAppt(BARBER_A, 'scheduled', 8, 9),
        makeAppt(BARBER_A, 'confirmed', 10, 11),
        makeAppt(BARBER_A, 'scheduled', 12, 13),
      ]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 10, 30, 0)),
        new Date(Date.UTC(2025, 0, 15, 11, 30, 0)),
      )
      expect(result).toBe(true)
    })

    it('handles multiple existing appointments — none overlap → allowed', () => {
      const existing = [
        makeAppt(BARBER_A, 'scheduled', 8, 9),
        makeAppt(BARBER_A, 'confirmed', 10, 11),
        makeAppt(BARBER_A, 'scheduled', 12, 13),
      ]
      const result = wouldOverlapActiveAppointments(
        existing, BARBER_A,
        new Date(Date.UTC(2025, 0, 15, 11, 0, 0)),
        new Date(Date.UTC(2025, 0, 15, 12, 0, 0)),
      )
      expect(result).toBe(false)
    })
  })
})
