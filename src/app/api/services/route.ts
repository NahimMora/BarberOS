import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { services } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  durationMinutes: z.number().int().positive(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
})

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select()
    .from(services)
    .where(and(eq(services.organizationId, user.organizationId), isNull(services.deletedAt)))
    .orderBy(services.name)

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    requireRole(user, ['admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [row] = await db
    .insert(services)
    .values({
      organizationId: user.organizationId,
      name: parsed.data.name,
      durationMinutes: parsed.data.durationMinutes,
      price: parsed.data.price,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
