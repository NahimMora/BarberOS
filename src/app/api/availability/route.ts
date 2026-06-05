import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  organizationSettings,
  barberSchedules,
  barberTimeOff,
  appointments,
  branches,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'

export async function GET(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const barberId = searchParams.get('barber_id')
  const branchId = searchParams.get('branch_id')
  const dateStr = searchParams.get('date') // YYYY-MM-DD
  const durationMinutes = parseInt(searchParams.get('duration_minutes') ?? '30', 10)

  if (!barberId || !branchId || !dateStr) {
    return NextResponse.json({ error: 'barber_id, branch_id y date son requeridos' }, { status: 400 })
  }

  // Read slot config from organization_settings
  const [settings] = await db
    .select({
      slotIntervalMinutes: organizationSettings.slotIntervalMinutes,
      bufferMinutes: organizationSettings.defaultAppointmentBufferMinutes,
    })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, user.organizationId))
    .limit(1)

  const slotInterval = settings?.slotIntervalMinutes ?? 30
  const buffer = settings?.bufferMinutes ?? 5

  // Parse date in UTC
  const [year, month, day] = dateStr.split('-').map(Number)
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59))
  const weekday = dayStart.getUTCDay()

  // Get branch timezone to adjust display, but store in UTC
  const [branch] = await db
    .select({ workingHours: branches.workingHours })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, user.organizationId)))
    .limit(1)

  if (!branch) {
    return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  // Get barber schedule for this weekday
  const schedules = await db
    .select()
    .from(barberSchedules)
    .where(
      and(
        eq(barberSchedules.organizationId, user.organizationId),
        eq(barberSchedules.barberId, barberId),
        eq(barberSchedules.branchId, branchId),
        eq(barberSchedules.weekday, weekday),
        eq(barberSchedules.active, true),
      ),
    )

  if (schedules.length === 0) {
    return NextResponse.json({ slots: [], reason: 'El barbero no trabaja ese día' })
  }

  // Get time_off blocks for this day
  const timeOffBlocks = await db
    .select({ startAt: barberTimeOff.startAt, endAt: barberTimeOff.endAt })
    .from(barberTimeOff)
    .where(
      and(
        eq(barberTimeOff.organizationId, user.organizationId),
        eq(barberTimeOff.barberId, barberId),
        sql`${barberTimeOff.startAt} < ${dayEnd}`,
        sql`${barberTimeOff.endAt} > ${dayStart}`,
      ),
    )

  // Get existing active appointments for this barber on this day
  const existingAppointments = await db
    .select({ startAt: appointments.startAt, endAt: appointments.endAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, user.organizationId),
        eq(appointments.barberId, barberId),
        sql`${appointments.status} IN ('scheduled','confirmed','in_progress')`,
        sql`${appointments.startAt} < ${dayEnd}`,
        sql`${appointments.endAt} > ${dayStart}`,
      ),
    )

  // Generate slots for each schedule block
  const slots: { startAt: string; endAt: string }[] = []

  for (const schedule of schedules) {
    const [sh, sm] = schedule.startTime.split(':').map(Number)
    const [eh, em] = schedule.endTime.split(':').map(Number)

    let slotStart = new Date(Date.UTC(year, month - 1, day, sh, sm, 0))
    const scheduleEnd = new Date(Date.UTC(year, month - 1, day, eh, em, 0))

    while (slotStart.getTime() + durationMinutes * 60000 <= scheduleEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)

      const isBlocked =
        timeOffBlocks.some(b => b.startAt < slotEnd && b.endAt > slotStart) ||
        existingAppointments.some(a => {
          const aEnd = new Date(a.endAt.getTime() + buffer * 60000)
          return a.startAt < slotEnd && aEnd > slotStart
        })

      if (!isBlocked) {
        slots.push({
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
        })
      }

      slotStart = new Date(slotStart.getTime() + slotInterval * 60000)
    }
  }

  return NextResponse.json({ slots })
}
