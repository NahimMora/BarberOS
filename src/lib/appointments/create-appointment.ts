import { and, eq, inArray, isNull } from 'drizzle-orm'
import {
  appointments,
  appointmentServices,
  appointmentHistory,
  auditLogs,
  domainEvents,
  branches,
  clients,
  services,
  userBranches,
  users,
} from '@/db/schema'
import { db } from '@/lib/db'
import {
  validateNoOverlap,
  validateBarberAvailability,
  validateBranchWorkingHours,
  OverlapError,
  AvailabilityError,
} from './validate'

// Quién origina el turno — determina created_by_user_id/created_by_client_id
// (exactamente uno, ver el CHECK en migrations) y a quién se le atribuye en
// appointment_history/audit_logs. Usado tanto por el endpoint de staff
// (POST /api/appointments) como por el de la APP (POST /api/client/appointments)
// para que el motor de agenda corra siempre por el mismo camino.
export type AppointmentActor =
  | { type: 'staff'; userId: string }
  | { type: 'client'; clientId: string }

export type CreateAppointmentInput = {
  organizationId: string
  branchId: string
  barberId: string
  clientId: string | null
  source: 'booked' | 'walk_in'
  startAt: Date
  serviceIds: string[]
  notes?: string | null
  actor: AppointmentActor
}

export class AppointmentInputError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AppointmentInputError'
    this.status = status
  }
}

export { OverlapError, AvailabilityError }

export async function createAppointment(input: CreateAppointmentInput) {
  const { organizationId, branchId, barberId, clientId, source, startAt, serviceIds, notes, actor } = input

  const [barber] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(
      userBranches,
      and(eq(userBranches.userId, users.id), eq(userBranches.branchId, branchId)),
    )
    .where(
      and(
        eq(users.id, barberId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'barber'),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)

  if (!barber) {
    throw new AppointmentInputError('Barbero no disponible en la sucursal', 400)
  }

  if (clientId) {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, organizationId),
          eq(clients.active, true),
          isNull(clients.deletedAt),
        ),
      )
      .limit(1)
    if (!client) {
      throw new AppointmentInputError('Cliente no encontrado', 400)
    }
  }

  const serviceRows = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.organizationId, organizationId),
        inArray(services.id, serviceIds),
        eq(services.active, true),
        isNull(services.deletedAt),
      ),
    )

  if (serviceRows.length !== serviceIds.length) {
    throw new AppointmentInputError('Uno o más servicios no encontrados', 400)
  }

  const totalDuration = serviceRows.reduce((acc, s) => acc + s.durationMinutes, 0)
  const endAt = new Date(startAt.getTime() + totalDuration * 60000)

  const [branch] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)))
    .limit(1)

  if (!branch) {
    throw new AppointmentInputError('Sucursal no encontrada', 404)
  }

  // Pre-check fuera de la transacción (mismo motivo que antes: falla rápido
  // sin abrir una transacción para el caso común) + re-check adentro, que es
  // el que realmente importa contra condiciones de carrera.
  validateBranchWorkingHours(branch, startAt, endAt)
  await validateBarberAvailability(db, organizationId, barberId, branchId, startAt, endAt)
  await validateNoOverlap(db, barberId, startAt, endAt)

  const createdByUserId = actor.type === 'staff' ? actor.userId : null
  const createdByClientId = actor.type === 'client' ? actor.clientId : null
  const historyUserId = actor.type === 'staff' ? actor.userId : null
  const historyClientId = actor.type === 'client' ? actor.clientId : null

  return db.transaction(async (tx) => {
    validateBranchWorkingHours(branch, startAt, endAt)
    await validateBarberAvailability(tx, organizationId, barberId, branchId, startAt, endAt)
    await validateNoOverlap(tx, barberId, startAt, endAt)

    const [appointment] = await tx
      .insert(appointments)
      .values({
        organizationId,
        branchId,
        barberId,
        clientId: clientId ?? null,
        createdByUserId,
        createdByClientId,
        status: 'scheduled',
        source,
        startAt,
        endAt,
        notes: notes ?? null,
      })
      .returning()

    await tx.insert(appointmentServices).values(
      serviceRows.map((s) => ({
        organizationId,
        appointmentId: appointment.id,
        serviceId: s.id,
        priceAtTime: s.price,
        durationAtTime: s.durationMinutes,
      })),
    )

    await tx.insert(appointmentHistory).values({
      organizationId,
      appointmentId: appointment.id,
      action: 'created',
      toStatus: 'scheduled',
      userId: historyUserId,
      actorClientId: historyClientId,
    })

    await tx.insert(auditLogs).values({
      organizationId,
      userId: historyUserId,
      actorClientId: historyClientId,
      action: 'appointment.created',
      entity: 'appointments',
      entityId: appointment.id,
      diff: {
        branchId,
        barberId,
        clientId: clientId ?? null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        serviceIds,
      },
    })

    await tx.insert(domainEvents).values({
      organizationId,
      eventType: 'appointment.created',
      payload: { appointmentId: appointment.id, barberId, branchId },
      occurredAt: new Date(),
    })

    return appointment
  })
}
