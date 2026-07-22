import { NextResponse } from 'next/server'
import { z } from 'zod'
import { zodErrorMessage } from '@/lib/validation/zod-error'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointments, appointmentServices, services, branches, organizationSettings } from '@/db/schema'
import { getClientSession } from '@/lib/auth/get-client-session'
import {
  createAppointment,
  AppointmentInputError,
  OverlapError,
  AvailabilityError,
} from '@/lib/appointments/create-appointment'

const createSchema = z.object({
  branchId: z.string().uuid(),
  barberId: z.string().uuid(),
  startAt: z.string().datetime(),
  serviceIds: z.array(z.string().uuid()).min(1),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id: appointments.id,
      branchId: appointments.branchId,
      branchName: branches.name,
      barberId: appointments.barberId,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      notes: appointments.notes,
    })
    .from(appointments)
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .where(eq(appointments.clientId, client.id))
    .orderBy(appointments.startAt)
    .limit(100)

  const ids = rows.map((r) => r.id)
  const serviceRows = ids.length
    ? await db
        .select({
          appointmentId: appointmentServices.appointmentId,
          name: services.name,
          priceAtTime: appointmentServices.priceAtTime,
        })
        .from(appointmentServices)
        .innerJoin(services, eq(services.id, appointmentServices.serviceId))
        .where(inArray(appointmentServices.appointmentId, ids))
    : []

  const result = rows.map((r) => ({
    ...r,
    services: serviceRows.filter((s) => s.appointmentId === r.id).map((s) => ({ name: s.name, price: s.priceAtTime })),
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [settings] = await db
    .select({ clientBookingEnabled: organizationSettings.clientBookingEnabled })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, client.organizationId))
    .limit(1)
  if (!settings?.clientBookingEnabled) {
    return NextResponse.json({ error: 'El auto-agendado no está habilitado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  try {
    const result = await createAppointment({
      organizationId: client.organizationId,
      branchId: parsed.data.branchId,
      barberId: parsed.data.barberId,
      // Nunca confiar en un clientId que mande el cliente — siempre el suyo.
      clientId: client.id,
      source: 'booked',
      startAt: new Date(parsed.data.startAt),
      serviceIds: parsed.data.serviceIds,
      notes: parsed.data.notes,
      actor: { type: 'client', clientId: client.id },
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23P01') {
      return NextResponse.json({ error: 'El barbero ya tiene un turno en ese horario' }, { status: 409 })
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
