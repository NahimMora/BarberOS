import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointments, appointmentHistory, auditLogs, domainEvents } from '@/db/schema'
import { notifyUser } from '@/lib/notifications/send-push'
import {
  assertValidTransition,
  AppointmentTransitionError,
} from './state-machine'
import type { AppointmentStatus } from './types'
import { AppointmentInputError } from './create-appointment'
import type { AppointmentActor } from './create-appointment'

export { AppointmentTransitionError, AppointmentInputError }
export type AppointmentRow = typeof appointments.$inferSelect

// Motor compartido para cualquier cambio de estado de un turno (confirmar,
// iniciar, completar, cancelar, no-show). Lo usa tanto el PATCH de staff
// (cualquier transición válida) como el de la APP (que solo llama esto con
// newStatus='cancelled') — mismo camino de código, mismo state machine,
// misma auditoría, sin importar quién lo dispara.
export async function changeAppointmentStatus(
  id: string,
  current: AppointmentRow,
  newStatus: AppointmentStatus,
  cancelReason: string | undefined,
  actor: AppointmentActor,
) {
  assertValidTransition(current.status, newStatus)

  if (newStatus === 'cancelled' && !cancelReason) {
    throw new AppointmentInputError('Se requiere motivo de cancelación', 400)
  }

  const isSensitive = newStatus === 'completed' || newStatus === 'cancelled'
  const userId = actor.type === 'staff' ? actor.userId : null
  const actorClientId = actor.type === 'client' ? actor.clientId : null

  const updated = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set({
        status: newStatus,
        cancelReason: cancelReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning()

    await tx.insert(appointmentHistory).values({
      organizationId: current.organizationId,
      appointmentId: id,
      action: newStatus === 'cancelled' ? 'cancelled' : 'status_changed',
      fromStatus: current.status,
      toStatus: newStatus,
      reason: cancelReason,
      userId,
      actorClientId,
    })

    if (isSensitive) {
      await tx.insert(auditLogs).values({
        organizationId: current.organizationId,
        userId,
        actorClientId,
        action: `appointment.${newStatus}`,
        entity: 'appointments',
        entityId: id,
        diff: { from: current.status, to: newStatus },
      })
    }

    await tx.insert(domainEvents).values({
      organizationId: current.organizationId,
      eventType: `appointment.${newStatus}`,
      payload: { appointmentId: id },
      occurredAt: new Date(),
    })

    return updated
  })

  if (newStatus === 'cancelled') {
    const time = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(current.startAt)
    void notifyUser(current.organizationId, current.barberId, {
      title: 'Turno cancelado',
      body: `Turno de las ${time}hs cancelado${cancelReason ? `: ${cancelReason}` : ''}`,
      url: '/agenda',
      tag: `appointment-${id}`,
    })
  }

  return updated
}
