import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { barberSchedules, users } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'
import { barberBelongsToBranch } from '@/lib/auth/organization-scope'

const scheduleSchema = z.object({
  barberId: z.string().uuid(),
  branchId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
}).refine((value) => value.startTime < value.endTime, {
  message: 'La hora de fin debe ser posterior al inicio',
  path: ['endTime'],
})

async function getAdmin() {
  const user = await getSession()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    requireRole(user, ['admin'])
  } catch {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(request: Request) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const barberId = new URL(request.url).searchParams.get('barber_id')

  const conditions = [eq(barberSchedules.organizationId, auth.user.organizationId)]
  if (barberId) conditions.push(eq(barberSchedules.barberId, barberId))

  const rows = await db
    .select({
      id: barberSchedules.id,
      barberId: barberSchedules.barberId,
      barberName: users.fullName,
      branchId: barberSchedules.branchId,
      weekday: barberSchedules.weekday,
      startTime: barberSchedules.startTime,
      endTime: barberSchedules.endTime,
      active: barberSchedules.active,
    })
    .from(barberSchedules)
    .innerJoin(users, eq(users.id, barberSchedules.barberId))
    .where(and(...conditions))
    .orderBy(users.fullName, barberSchedules.weekday, barberSchedules.startTime)

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const parsed = scheduleSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  if (
    !(await barberBelongsToBranch(
      auth.user.organizationId,
      parsed.data.barberId,
      parsed.data.branchId,
    ))
  ) {
    return NextResponse.json({ error: 'Barbero o sucursal inválidos' }, { status: 400 })
  }

  const [existing] = await db
    .select({ id: barberSchedules.id })
    .from(barberSchedules)
    .where(
      and(
        eq(barberSchedules.organizationId, auth.user.organizationId),
        eq(barberSchedules.barberId, parsed.data.barberId),
        eq(barberSchedules.branchId, parsed.data.branchId),
        eq(barberSchedules.weekday, parsed.data.weekday),
        eq(barberSchedules.startTime, parsed.data.startTime),
      ),
    )
    .limit(1)
  if (existing) {
    return NextResponse.json({ error: 'Ya existe ese bloque de horario' }, { status: 409 })
  }

  const [schedule] = await db
    .insert(barberSchedules)
    .values({ organizationId: auth.user.organizationId, ...parsed.data })
    .returning()
  return NextResponse.json(schedule, { status: 201 })
}
