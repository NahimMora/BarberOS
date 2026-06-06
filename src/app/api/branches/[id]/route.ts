import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { branches } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  timezone: z.string().trim().max(100).nullable().optional(),
  workingHours: z.record(
    z.string(),
    z.object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
    }).nullable(),
  ).optional(),
  active: z.boolean().optional(),
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const { id } = await params
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [branch] = await db
    .update(branches)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(branches.id, id),
        eq(branches.organizationId, auth.user.organizationId),
        isNull(branches.deletedAt),
      ),
    )
    .returning()

  if (!branch) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(branch)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const { id } = await params

  const [branch] = await db
    .update(branches)
    .set({
      active: false,
      deletedAt: new Date(),
      deletedBy: auth.user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(branches.id, id),
        eq(branches.organizationId, auth.user.organizationId),
        isNull(branches.deletedAt),
      ),
    )
    .returning({ id: branches.id })

  if (!branch) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
