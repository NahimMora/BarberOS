import { NextResponse } from 'next/server'
import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointments, branches, clients } from '@/db/schema'
import { notifyUser } from '@/lib/notifications/send-push'

// Lo llama un scheduler externo (Render Cron Job, cada 5 min) — no es una
// sesión de usuario, se autentica con un secreto compartido. Ver
// docs/RUNBOOK.md para el alta del cron en Render.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() + 25 * 60_000)
  const windowEnd = new Date(now.getTime() + 35 * 60_000)

  const due = await db
    .select({
      id: appointments.id,
      organizationId: appointments.organizationId,
      barberId: appointments.barberId,
      startAt: appointments.startAt,
      branchName: branches.name,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(appointments)
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(
      inArray(appointments.status, ['scheduled', 'confirmed']),
      isNull(appointments.reminderSentAt),
      gte(appointments.startAt, windowStart),
      lt(appointments.startAt, windowEnd),
    ))

  for (const appointment of due) {
    const clientName = [appointment.clientFirstName, appointment.clientLastName]
      .filter(Boolean)
      .join(' ') || 'Sin cliente'

    await notifyUser(appointment.organizationId, appointment.barberId, {
      title: 'Turno en 30 minutos',
      body: `${clientName} · ${appointment.branchName}`,
      url: '/agenda',
      tag: `appointment-reminder-${appointment.id}`,
    })

    await db
      .update(appointments)
      .set({ reminderSentAt: now })
      .where(eq(appointments.id, appointment.id))
  }

  return NextResponse.json({ remindersSent: due.length })
}
