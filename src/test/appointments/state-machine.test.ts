import { describe, it, expect } from 'vitest'
import {
  assertValidTransition,
  AppointmentTransitionError,
  VALID_TRANSITIONS,
} from '@/lib/appointments/state-machine'
import type { AppointmentStatus } from '@/lib/appointments/types'

const ALL_STATUSES: AppointmentStatus[] = [
  'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show',
]

describe('assertValidTransition', () => {
  it('allows scheduled → confirmed', () => {
    expect(() => assertValidTransition('scheduled', 'confirmed')).not.toThrow()
  })

  it('allows scheduled → cancelled', () => {
    expect(() => assertValidTransition('scheduled', 'cancelled')).not.toThrow()
  })

  it('allows scheduled → no_show', () => {
    expect(() => assertValidTransition('scheduled', 'no_show')).not.toThrow()
  })

  it('allows confirmed → in_progress', () => {
    expect(() => assertValidTransition('confirmed', 'in_progress')).not.toThrow()
  })

  it('allows confirmed → cancelled', () => {
    expect(() => assertValidTransition('confirmed', 'cancelled')).not.toThrow()
  })

  it('allows confirmed → no_show', () => {
    expect(() => assertValidTransition('confirmed', 'no_show')).not.toThrow()
  })

  it('allows in_progress → completed', () => {
    expect(() => assertValidTransition('in_progress', 'completed')).not.toThrow()
  })

  it('rejects completed → any (terminal state)', () => {
    for (const to of ALL_STATUSES) {
      expect(() => assertValidTransition('completed', to)).toThrow(AppointmentTransitionError)
    }
  })

  it('rejects cancelled → any (terminal state)', () => {
    for (const to of ALL_STATUSES) {
      expect(() => assertValidTransition('cancelled', to)).toThrow(AppointmentTransitionError)
    }
  })

  it('rejects no_show → any (terminal state)', () => {
    for (const to of ALL_STATUSES) {
      expect(() => assertValidTransition('no_show', to)).toThrow(AppointmentTransitionError)
    }
  })

  it('rejects scheduled → in_progress (skip confirmed)', () => {
    expect(() => assertValidTransition('scheduled', 'in_progress')).toThrow(AppointmentTransitionError)
  })

  it('rejects scheduled → completed (skip multiple steps)', () => {
    expect(() => assertValidTransition('scheduled', 'completed')).toThrow(AppointmentTransitionError)
  })

  it('rejects in_progress → cancelled', () => {
    expect(() => assertValidTransition('in_progress', 'cancelled')).toThrow(AppointmentTransitionError)
  })

  it('throws AppointmentTransitionError with descriptive message', () => {
    expect(() => assertValidTransition('completed', 'scheduled'))
      .toThrow('Invalid transition: completed → scheduled')
  })

  it('covers all valid transitions from VALID_TRANSITIONS map', () => {
    for (const [from, targets] of Object.entries(VALID_TRANSITIONS) as [AppointmentStatus, AppointmentStatus[]][]) {
      for (const to of targets) {
        expect(() => assertValidTransition(from, to)).not.toThrow()
      }
    }
  })
})
