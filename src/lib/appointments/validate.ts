import { and, eq, ne, lt, gt, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '@/db/schema'
import { appointments, barberSchedules, barberTimeOff } from '@/db/schema'
import type { Branch } from '@/db/schema'

type DB = PostgresJsDatabase<typeof schema>

export async function validateNoOverlap(
  db: DB,
  barberId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string,
): Promise<void> {
  const conditions = [
    eq(appointments.barberId, barberId),
    sql`${appointments.status} IN ('scheduled','confirmed','in_progress')`,
    lt(appointments.startAt, endAt),
    gt(appointments.endAt, startAt),
  ]
  if (excludeId) {
    conditions.push(ne(appointments.id, excludeId))
  }

  const overlapping = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(...conditions))
    .limit(1)

  if (overlapping.length > 0) {
    throw new OverlapError('El barbero ya tiene un turno en ese horario')
  }
}

export async function validateBarberAvailability(
  db: DB,
  organizationId: string,
  barberId: string,
  branchId: string,
  startAt: Date,
  endAt: Date,
): Promise<void> {
  // Check barber_time_off
  const timeOff = await db
    .select({ id: barberTimeOff.id })
    .from(barberTimeOff)
    .where(
      and(
        eq(barberTimeOff.organizationId, organizationId),
        eq(barberTimeOff.barberId, barberId),
        lt(barberTimeOff.startAt, endAt),
        gt(barberTimeOff.endAt, startAt),
      ),
    )
    .limit(1)

  if (timeOff.length > 0) {
    throw new AvailabilityError('El barbero tiene tiempo libre registrado en ese horario')
  }

  // Check barber_schedules — must have an active schedule covering the slot
  const weekday = startAt.getUTCDay()
  const startTimeStr = toTimeString(startAt)
  const endTimeStr = toTimeString(endAt)

  const schedules = await db
    .select({ id: barberSchedules.id })
    .from(barberSchedules)
    .where(
      and(
        eq(barberSchedules.organizationId, organizationId),
        eq(barberSchedules.barberId, barberId),
        eq(barberSchedules.branchId, branchId),
        eq(barberSchedules.weekday, weekday),
        eq(barberSchedules.active, true),
        sql`${barberSchedules.startTime} <= ${startTimeStr}`,
        sql`${barberSchedules.endTime} >= ${endTimeStr}`,
      ),
    )
    .limit(1)

  if (schedules.length === 0) {
    throw new AvailabilityError('El barbero no trabaja en ese horario')
  }
}

type WorkingHours = Record<string, { open: string; close: string } | null>

export function validateBranchWorkingHours(
  branch: Pick<Branch, 'workingHours'>,
  startAt: Date,
  endAt: Date,
): void {
  if (!branch.workingHours) return

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const dayKey = days[startAt.getUTCDay()]
  const wh = (branch.workingHours as WorkingHours)[dayKey]

  if (!wh) {
    throw new AvailabilityError('La sucursal no trabaja ese día')
  }

  const startTime = toTimeString(startAt)
  const endTime = toTimeString(endAt)

  if (startTime < wh.open || endTime > wh.close) {
    throw new AvailabilityError('El turno está fuera del horario de la sucursal')
  }
}

function toTimeString(date: Date): string {
  const h = date.getUTCHours().toString().padStart(2, '0')
  const m = date.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export class OverlapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OverlapError'
  }
}

export class AvailabilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AvailabilityError'
  }
}
