import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  appointments,
  appointmentServices,
  appointmentHistory,
  auditLogs,
  domainEvents,
  services,
  branches,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import {
  assertValidTransition,
  AppointmentTransitionError,
} from '@/lib/appointments/state-machine'
import {
  validateNoOverlap,
  validateBarberAvailability,
  validateBranchWorkingHours,
  OverlapError,
  AvailabilityError,
} from '@/lib/appointments/validate'
import type { AppointmentStatus } from '@/lib/appointments/types'
import { canAccessAppointment } from '@/lib/auth/authorization'

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('status_change'),
    newStatus: z.enum(['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
    cancelReason: z.string().optional(),
  }),
  z.object({
    action: z.literal('reschedule'),
    startAt: z.string().datetime(),
    serviceIds: z.array(z.string().uuid()).min(1).optional(),
    barberId: z.string().uuid().optional(),
    reason: z.string().optional(),
  }),
])

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.organizationId, user.organizationId)))
    .limit(1)

  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Barber can only see their own appointments
  if (!canAccessAppointment(user, appointment.branchId, appointment.barberId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const apptServices = await db
    .select()
    .from(appointmentServices)
    .where(eq(appointmentServices.appointmentId, id))

  const history = await db
    .select()
    .from(appointmentHistory)
    .where(eq(appointmentHistory.appointmentId, id))
    .orderBy(appointmentHistory.createdAt)

  return NextResponse.json({ ...appointment, services: apptServices, history })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [current] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.organizationId, user.organizationId)))
    .limit(1)

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Barbers can only change their own appointments
  if (!canAccessAppointment(user, current.branchId, current.barberId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    if (parsed.data.action === 'status_change') {
      return await handleStatusChange(id, current, parsed.data, user)
    } else {
      return await handleReschedule(id, current, parsed.data, user)
    }
  } catch (err: unknown) {
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return PATCH(
    new Request('', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'status_change', newStatus: 'cancelled', cancelReason: 'Cancelado' }),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params },
  )
}

type AppointmentRow = typeof appointments.$inferSelect
type AppUser = { id: string; organizationId: string; role: string }

async function handleStatusChange(
  id: string,
  current: AppointmentRow,
  data: { action: 'status_change'; newStatus: string; cancelReason?: string },
  user: AppUser,
) {
  try {
    assertValidTransition(current.status, data.newStatus as AppointmentStatus)
  } catch (err) {
    if (err instanceof AppointmentTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }

  if (data.newStatus === 'cancelled' && !data.cancelReason) {
    return NextResponse.json({ error: 'Se requiere motivo de cancelación' }, { status: 400 })
  }

  const isSensitive = data.newStatus === 'completed' || data.newStatus === 'cancelled'

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set({
        status: data.newStatus as AppointmentStatus,
        cancelReason: data.cancelReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning()

    await tx.insert(appointmentHistory).values({
      organizationId: current.organizationId,
      appointmentId: id,
      action: data.newStatus === 'cancelled' ? 'cancelled' : 'status_changed',
      fromStatus: current.status,
      toStatus: data.newStatus as AppointmentStatus,
      reason: data.cancelReason,
      userId: user.id,
    })

    if (isSensitive) {
      await tx.insert(auditLogs).values({
        organizationId: current.organizationId,
        userId: user.id,
        action: `appointment.${data.newStatus}`,
        entity: 'appointments',
        entityId: id,
        diff: { from: current.status, to: data.newStatus },
      })
    }

    await tx.insert(domainEvents).values({
      organizationId: current.organizationId,
      eventType: `appointment.${data.newStatus}`,
      payload: { appointmentId: id },
      occurredAt: new Date(),
    })

    return updated
  })

  return NextResponse.json(result)
}

async function handleReschedule(
  id: string,
  current: AppointmentRow,
  data: { action: 'reschedule'; startAt: string; serviceIds?: string[]; barberId?: string; reason?: string },
  user: AppUser,
) {
  const newBarberId = data.barberId ?? current.barberId
  if (user.role === 'barber' && newBarberId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const startAt = new Date(data.startAt)

  // Compute duration
  let totalDuration: number
  let serviceRows: { id: string; price: string; durationMinutes: number }[] = []

  if (data.serviceIds) {
    serviceRows = await db
      .select({ id: services.id, price: services.price, durationMinutes: services.durationMinutes })
      .from(services)
      .where(
        and(
          eq(services.organizationId, current.organizationId),
          inArray(services.id, data.serviceIds),
        ),
      )
    totalDuration = serviceRows.reduce((a, s) => a + s.durationMinutes, 0)
  } else {
    const existing = await db
      .select({ durationAtTime: appointmentServices.durationAtTime })
      .from(appointmentServices)
      .where(eq(appointmentServices.appointmentId, id))
    totalDuration = existing.reduce((a, s) => a + s.durationAtTime, 0)
  }

  const endAt = new Date(startAt.getTime() + totalDuration * 60000)

  const [branch] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.id, current.branchId), eq(branches.organizationId, current.organizationId)))
    .limit(1)

  try {
    if (branch) validateBranchWorkingHours(branch, startAt, endAt)
    await validateBarberAvailability(db, current.organizationId, newBarberId, current.branchId, startAt, endAt)
    await validateNoOverlap(db, newBarberId, startAt, endAt, id)
  } catch (err) {
    if (err instanceof AvailabilityError || err instanceof OverlapError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set({
        barberId: newBarberId,
        startAt,
        endAt,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning()

    if (data.serviceIds && serviceRows.length > 0) {
      await tx.delete(appointmentServices).where(eq(appointmentServices.appointmentId, id))
      await tx.insert(appointmentServices).values(
        serviceRows.map((s) => ({
          appointmentId: id,
          serviceId: s.id,
          priceAtTime: s.price,
          durationAtTime: s.durationMinutes,
        })),
      )
    }

    const action = data.barberId && data.barberId !== current.barberId ? 'barber_changed' : 'rescheduled'

    await tx.insert(appointmentHistory).values({
      organizationId: current.organizationId,
      appointmentId: id,
      action,
      fromStartAt: current.startAt,
      toStartAt: startAt,
      fromEndAt: current.endAt,
      toEndAt: endAt,
      fromBarberId: current.barberId,
      toBarberId: newBarberId,
      reason: data.reason,
      userId: user.id,
    })

    await tx.insert(domainEvents).values({
      organizationId: current.organizationId,
      eventType: 'appointment.rescheduled',
      payload: { appointmentId: id },
      occurredAt: new Date(),
    })

    return updated
  })

  return NextResponse.json(result)
}
