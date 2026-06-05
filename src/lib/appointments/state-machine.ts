import type { AppointmentStatus } from './types'

export const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled:   ['confirmed', 'cancelled', 'no_show'],
  confirmed:   ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed:   [],
  cancelled:   [],
  no_show:     [],
}

export class AppointmentTransitionError extends Error {
  constructor(from: AppointmentStatus, to: AppointmentStatus) {
    super(`Invalid transition: ${from} → ${to}`)
    this.name = 'AppointmentTransitionError'
  }
}

export function assertValidTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new AppointmentTransitionError(from, to)
  }
}
