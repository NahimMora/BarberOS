import { eq, and, gt, inArray, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { organizationSettings, barberSchedules, barberTimeOff, appointments, branches } from '@/db/schema'
import { getLocalDayUtcRange } from '@/lib/datetime/local-day-range'

export class AvailabilityInputError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AvailabilityInputError'
    this.status = status
  }
}

export type AvailabilitySlot = { startAt: string; endAt: string }

// Calcula los huecos libres de un barbero en una sucursal/día. Reusado por
// el endpoint de staff (GET /api/availability) y el de la APP
// (GET /api/client/availability) — un solo cálculo de horarios/turnos
// existentes/tiempo libre, sin importar quién lo consulta.
export async function computeAvailableSlots(params: {
  organizationId: string
  branchId: string
  barberId: string
  dateStr: string
  durationMinutes: number
}): Promise<{ slots: AvailabilitySlot[]; reason?: string }> {
  const { organizationId, branchId, barberId, dateStr, durationMinutes } = params

  const [settings] = await db
    .select({
      slotIntervalMinutes: organizationSettings.slotIntervalMinutes,
      bufferMinutes: organizationSettings.defaultAppointmentBufferMinutes,
    })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1)

  const slotInterval = settings?.slotIntervalMinutes ?? 30
  const buffer = settings?.bufferMinutes ?? 5

  const [branch] = await db
    .select({ workingHours: branches.workingHours, timezone: branches.timezone })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)))
    .limit(1)

  if (!branch) {
    throw new AvailabilityInputError('Sucursal no encontrada', 404)
  }

  const timeZone = branch.timezone ?? 'America/Argentina/Buenos_Aires'
  let dayStart: Date
  let dayEnd: Date
  try {
    const range = getLocalDayUtcRange(dateStr, timeZone)
    dayStart = range.start
    dayEnd = range.end
  } catch {
    throw new AvailabilityInputError('Fecha inválida', 400)
  }
  const [year, month, day] = dateStr.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

  const schedules = await db
    .select()
    .from(barberSchedules)
    .where(
      and(
        eq(barberSchedules.organizationId, organizationId),
        eq(barberSchedules.barberId, barberId),
        eq(barberSchedules.branchId, branchId),
        eq(barberSchedules.weekday, weekday),
        eq(barberSchedules.active, true),
      ),
    )

  if (schedules.length === 0) {
    return { slots: [], reason: 'El barbero no trabaja ese día' }
  }

  const timeOffBlocks = await db
    .select({ startAt: barberTimeOff.startAt, endAt: barberTimeOff.endAt })
    .from(barberTimeOff)
    .where(
      and(
        eq(barberTimeOff.organizationId, organizationId),
        eq(barberTimeOff.barberId, barberId),
        lt(barberTimeOff.startAt, dayEnd),
        gt(barberTimeOff.endAt, dayStart),
      ),
    )

  const existingAppointments = await db
    .select({ startAt: appointments.startAt, endAt: appointments.endAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, organizationId),
        eq(appointments.barberId, barberId),
        inArray(appointments.status, ['scheduled', 'confirmed', 'in_progress']),
        lt(appointments.startAt, dayEnd),
        gt(appointments.endAt, dayStart),
      ),
    )

  const slots: AvailabilitySlot[] = []

  for (const schedule of schedules) {
    const [sh, sm] = schedule.startTime.split(':').map(Number)
    const [eh, em] = schedule.endTime.split(':').map(Number)

    const offsetMs = dayStart.getTime() - Date.UTC(year, month - 1, day)
    let slotStart = new Date(Date.UTC(year, month - 1, day, sh, sm, 0) + offsetMs)
    const scheduleEnd = new Date(Date.UTC(year, month - 1, day, eh, em, 0) + offsetMs)

    while (slotStart.getTime() + durationMinutes * 60000 <= scheduleEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)

      const isBlocked =
        timeOffBlocks.some((b) => b.startAt < slotEnd && b.endAt > slotStart) ||
        existingAppointments.some((a) => {
          const aEnd = new Date(a.endAt.getTime() + buffer * 60000)
          return a.startAt < slotEnd && aEnd > slotStart
        })

      if (!isBlocked) {
        slots.push({ startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() })
      }

      slotStart = new Date(slotStart.getTime() + slotInterval * 60000)
    }
  }

  return { slots }
}
