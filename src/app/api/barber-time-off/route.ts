import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { barberTimeOff, users } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'
import { barberBelongsToBranch } from '@/lib/auth/organization-scope'

const timeOffSchema = z.object({
  barberId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().trim().max(1000).optional(),
}).refine((value) => new Date(value.startAt) < new Date(value.endAt), {
  message: 'La fecha de fin debe ser posterior al inicio',
  path: ['endAt'],
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

export async function GET() {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const rows = await db
    .select({
      id: barberTimeOff.id,
      barberId: barberTimeOff.barberId,
      barberName: users.fullName,
      branchId: barberTimeOff.branchId,
      startAt: barberTimeOff.startAt,
      endAt: barberTimeOff.endAt,
      reason: barberTimeOff.reason,
    })
    .from(barberTimeOff)
    .innerJoin(users, eq(users.id, barberTimeOff.barberId))
    .where(eq(barberTimeOff.organizationId, auth.user.organizationId))
    .orderBy(barberTimeOff.startAt)
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const parsed = timeOffSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  if (
    parsed.data.branchId &&
    !(await barberBelongsToBranch(
      auth.user.organizationId,
      parsed.data.barberId,
      parsed.data.branchId,
    ))
  ) {
    return NextResponse.json({ error: 'Barbero o sucursal inválidos' }, { status: 400 })
  }
  const [row] = await db
    .insert(barberTimeOff)
    .values({
      organizationId: auth.user.organizationId,
      barberId: parsed.data.barberId,
      branchId: parsed.data.branchId ?? null,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      reason: parsed.data.reason || null,
      createdBy: auth.user.id,
    })
    .returning()
  return NextResponse.json(row, { status: 201 })
}

export async function DELETE(request: Request) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const [row] = await db
    .delete(barberTimeOff)
    .where(
      and(
        eq(barberTimeOff.id, id),
        eq(barberTimeOff.organizationId, auth.user.organizationId),
      ),
    )
    .returning({ id: barberTimeOff.id })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
