import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, gte, inArray, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  appointments,
  appointmentServices,
  appointmentHistory,
  domainEvents,
  organizationSettings,
  services,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { validateNoOverlap, validateBarberAvailability, validateBranchWorkingHours, OverlapError, AvailabilityError } from '@/lib/appointments/validate'
import { branches } from '@/db/schema'
import { getLocalDayUtcRange } from '@/lib/datetime/local-day-range'

const createSchema = z.object({
  branchId: z.string().uuid(),
  barberId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  source: z.enum(['booked', 'walk_in']).default('booked'),
  startAt: z.string().datetime(),
  serviceIds: z.array(z.string().uuid()).min(1),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // YYYY-MM-DD
  const barberId = searchParams.get('barber_id')
  const branchId = searchParams.get('branch_id')
  const status = searchParams.get('status')

  const conditions = [eq(appointments.organizationId, user.organizationId)]

  if (barberId) conditions.push(eq(appointments.barberId, barberId))
  if (branchId) conditions.push(eq(appointments.branchId, branchId))
  if (status && ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(status)) {
    conditions.push(eq(appointments.status, status as typeof appointments.status.enumValues[number]))
  }
  if (date) {
    const [settings] = await db
      .select({ defaultTimezone: organizationSettings.defaultTimezone })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, user.organizationId))
      .limit(1)
    const timeZone = settings?.defaultTimezone ?? 'America/Argentina/Buenos_Aires'

    try {
      const range = getLocalDayUtcRange(date, timeZone)
      conditions.push(gte(appointments.startAt, range.start), lt(appointments.startAt, range.end))
    } catch {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    }
  }

  // Barbers only see their own appointments
  if (user.role === 'barber') {
    conditions.push(eq(appointments.barberId, user.id))
  }

  const rows = await db
    .select()
    .from(appointments)
    .where(and(...conditions))
    .orderBy(appointments.startAt)
    .limit(200)

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { branchId, barberId, clientId, source, startAt: startAtStr, serviceIds, notes } = parsed.data

  // Fetch services to compute end time
  const serviceRows = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.organizationId, user.organizationId),
        inArray(services.id, serviceIds),
      ),
    )

  if (serviceRows.length !== serviceIds.length) {
    return NextResponse.json({ error: 'Uno o más servicios no encontrados' }, { status: 400 })
  }

  const totalDuration = serviceRows.reduce((acc, s) => acc + s.durationMinutes, 0)
  const startAt = new Date(startAtStr)
  const endAt = new Date(startAt.getTime() + totalDuration * 60000)

  // Fetch branch for working hours validation
  const [branch] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, user.organizationId)))
    .limit(1)

  if (!branch) {
    return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  try {
    validateBranchWorkingHours(branch, startAt, endAt)
    await validateBarberAvailability(db, user.organizationId, barberId, branchId, startAt, endAt)
    await validateNoOverlap(db, barberId, startAt, endAt)
  } catch (err) {
    if (err instanceof AvailabilityError || err instanceof OverlapError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [appointment] = await tx
        .insert(appointments)
        .values({
          organizationId: user.organizationId,
          branchId,
          barberId,
          clientId: clientId ?? null,
          createdByUserId: user.id,
          status: 'scheduled',
          source,
          startAt,
          endAt,
          notes: notes ?? null,
        })
        .returning()

      await tx.insert(appointmentServices).values(
        serviceRows.map((s) => ({
          appointmentId: appointment.id,
          serviceId: s.id,
          priceAtTime: s.price,
          durationAtTime: s.durationMinutes,
        })),
      )

      await tx.insert(appointmentHistory).values({
        organizationId: user.organizationId,
        appointmentId: appointment.id,
        action: 'created',
        toStatus: 'scheduled',
        userId: user.id,
      })

      await tx.insert(domainEvents).values({
        organizationId: user.organizationId,
        eventType: 'appointment.created',
        payload: { appointmentId: appointment.id, barberId, branchId },
        occurredAt: new Date(),
      })

      return appointment
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    // Postgres exclusion_violation (23P01) — double-booking despite pre-check
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23P01') {
      return NextResponse.json(
        { error: 'El barbero ya tiene un turno en ese horario' },
        { status: 409 },
      )
    }
    throw err
  }
}
