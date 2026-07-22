import { NextResponse } from 'next/server'
import { getClientSession } from '@/lib/auth/get-client-session'
import { computeAvailableSlots, AvailabilityInputError } from '@/lib/appointments/availability'

export async function GET(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const barberId = searchParams.get('barber_id')
  const branchId = searchParams.get('branch_id')
  const dateStr = searchParams.get('date')
  const durationMinutes = parseInt(searchParams.get('duration_minutes') ?? '30', 10)

  if (!barberId || !branchId || !dateStr) {
    return NextResponse.json({ error: 'barber_id, branch_id y date son requeridos' }, { status: 400 })
  }

  try {
    const result = await computeAvailableSlots({
      organizationId: client.organizationId,
      branchId,
      barberId,
      dateStr,
      durationMinutes,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AvailabilityInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
