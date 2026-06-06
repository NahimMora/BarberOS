import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { branches } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'

const branchSchema = z.object({
  name: z.string().trim().min(1).max(255),
  address: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(50).optional(),
  timezone: z.string().trim().max(100).default('America/Argentina/Buenos_Aires'),
  workingHours: z.record(
    z.string(),
    z.object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
    }).nullable(),
  ),
})

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conditions = [
    eq(branches.organizationId, user.organizationId),
    isNull(branches.deletedAt),
  ]
  if (user.role !== 'admin') {
    if (user.branchIds.length === 0) return NextResponse.json([])
    conditions.push(inArray(branches.id, user.branchIds))
  }

  const rows = await db
    .select()
    .from(branches)
    .where(and(...conditions))
    .orderBy(branches.name)

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    requireRole(user, ['admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = branchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [branch] = await db
    .insert(branches)
    .values({
      organizationId: user.organizationId,
      ...parsed.data,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
    })
    .returning()

  return NextResponse.json(branch, { status: 201 })
}
