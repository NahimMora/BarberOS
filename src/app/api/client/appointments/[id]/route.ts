import { NextResponse } from 'next/server'
import { z } from 'zod'
import { zodErrorMessage } from '@/lib/validation/zod-error'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointments } from '@/db/schema'
import { getClientSession } from '@/lib/auth/get-client-session'
import {
  changeAppointmentStatus,
  AppointmentTransitionError,
  AppointmentInputError,
} from '@/lib/appointments/cancel-appointment'
import { OverlapError, AvailabilityError } from '@/lib/appointments/validate'

const cancelSchema = z.object({
  cancelReason: z.string().min(1),
})

// El cliente solo puede cancelar sus propios turnos — nunca confirmar,
// iniciar, completar ni reprogramar (eso sigue siendo staff-only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [current] = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.id, id),
        eq(appointments.organizationId, client.organizationId),
        eq(appointments.clientId, client.id),
      ),
    )
    .limit(1)
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  try {
    const result = await changeAppointmentStatus(
      id,
      current,
      'cancelled',
      parsed.data.cancelReason,
      { type: 'client', clientId: client.id },
    )
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof AppointmentTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    if (err instanceof AppointmentInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof AvailabilityError || err instanceof OverlapError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }
}
