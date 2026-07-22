import { NextResponse } from 'next/server'
import { z } from 'zod'
import { zodErrorMessage } from '@/lib/validation/zod-error'
import { eq, and, gte, inArray, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  appointments,
  clients,
  organizationSettings,
  sales,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import {
  createAppointment,
  AppointmentInputError,
  OverlapError,
  AvailabilityError,
} from '@/lib/appointments/create-appointment'
import { getLocalDayUtcRange } from '@/lib/datetime/local-day-range'
import { canCreateAppointment, hasBranchAccess } from '@/lib/auth/authorization'

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
  if (branchId) {
    if (!hasBranchAccess(user, branchId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    conditions.push(eq(appointments.branchId, branchId))
  } else if (user.role !== 'admin') {
    if (user.branchIds.length === 0) return NextResponse.json([])
    conditions.push(inArray(appointments.branchId, user.branchIds))
  }
  if (status) {
    if (!['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }
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
    .select({
      id: appointments.id,
      branchId: appointments.branchId,
      barberId: appointments.barberId,
      clientId: appointments.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      status: appointments.status,
      source: appointments.source,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      notes: appointments.notes,
      saleId: sales.id,
    })
    .from(appointments)
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .leftJoin(
      sales,
      and(
        eq(sales.appointmentId, appointments.id),
        eq(sales.organizationId, user.organizationId),
      ),
    )
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
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  const { branchId, barberId, clientId, source, startAt: startAtStr, serviceIds, notes } = parsed.data
  if (!canCreateAppointment(user, branchId, barberId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [settings] = await db
    .select({ allowAnonymousWalkin: organizationSettings.allowAnonymousWalkin })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, user.organizationId))
    .limit(1)
  if (source === 'booked' && !clientId) {
    return NextResponse.json({ error: 'Un turno agendado requiere cliente' }, { status: 400 })
  }
  if (source === 'walk_in' && !clientId && !settings?.allowAnonymousWalkin) {
    return NextResponse.json({ error: 'Los walk-in anónimos no están habilitados' }, { status: 403 })
  }

  try {
    const result = await createAppointment({
      organizationId: user.organizationId,
      branchId,
      barberId,
      clientId: clientId ?? null,
      source,
      startAt: new Date(startAtStr),
      serviceIds,
      notes,
      actor: { type: 'staff', userId: user.id },
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
    if (err instanceof AvailabilityError || err instanceof OverlapError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof AppointmentInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
