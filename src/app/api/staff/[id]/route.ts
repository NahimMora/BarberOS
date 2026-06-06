import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { barberProfiles, userBranches, users } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { branchesBelongToOrganization } from '@/lib/auth/organization-scope'

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(255).optional(),
  role: z.enum(['admin', 'receptionist', 'barber']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
  commissionRate: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).nullable().optional(),
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

  const [current] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, id),
        eq(users.organizationId, auth.user.organizationId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const nextRole = parsed.data.role ?? current.role
  const nextStatus = parsed.data.status ?? current.status
  const branchIds = parsed.data.branchIds
  if (
    id === auth.user.id &&
    (nextStatus === 'disabled' || nextRole !== 'admin')
  ) {
    return NextResponse.json(
      { error: 'No puede quitarse su propio acceso de administrador' },
      { status: 400 },
    )
  }
  if (nextRole !== 'admin' && branchIds && branchIds.length === 0) {
    return NextResponse.json({ error: 'Debe asignar al menos una sucursal' }, { status: 400 })
  }
  if (
    branchIds &&
    !(await branchesBelongToOrganization(auth.user.organizationId, branchIds))
  ) {
    return NextResponse.json({ error: 'Una o más sucursales no son válidas' }, { status: 400 })
  }

  const supabaseAdmin = createSupabaseAdminClient()
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(current.authId, {
    ban_duration: nextStatus === 'disabled' ? '876000h' : 'none',
    app_metadata: {
      organization_id: auth.user.organizationId,
      role: nextRole,
    },
    user_metadata: {
      full_name: parsed.data.fullName ?? current.fullName,
    },
  })
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const updated = await db.transaction(async (tx) => {
    const [staff] = await tx
      .update(users)
      .set({
        fullName: parsed.data.fullName ?? current.fullName,
        role: nextRole,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    if (branchIds) {
      await tx.delete(userBranches).where(eq(userBranches.userId, id))
      if (branchIds.length > 0) {
        await tx.insert(userBranches).values(
          branchIds.map((branchId) => ({
            organizationId: auth.user.organizationId,
            userId: id,
            branchId,
          })),
        )
      }
    }

    const [profile] = await tx
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(eq(barberProfiles.userId, id))
      .limit(1)
    if (nextRole === 'barber') {
      if (profile) {
        await tx
          .update(barberProfiles)
          .set({
            commissionRate: parsed.data.commissionRate,
            active: nextStatus === 'active',
            updatedAt: new Date(),
          })
          .where(eq(barberProfiles.userId, id))
      } else {
        await tx.insert(barberProfiles).values({
          organizationId: auth.user.organizationId,
          userId: id,
          commissionRate: parsed.data.commissionRate ?? null,
          active: nextStatus === 'active',
        })
      }
    } else if (profile) {
      await tx
        .update(barberProfiles)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(barberProfiles.userId, id))
    }

    return staff
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const { id } = await params
  if (id === auth.user.id) {
    return NextResponse.json({ error: 'No puede deshabilitar su propio usuario' }, { status: 400 })
  }

  const [current] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, id),
        eq(users.organizationId, auth.user.organizationId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabaseAdmin = createSupabaseAdminClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(current.authId, {
    ban_duration: '876000h',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: 'disabled',
        deletedAt: new Date(),
        deletedBy: auth.user.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
    await tx
      .update(barberProfiles)
      .set({
        active: false,
        deletedAt: new Date(),
        deletedBy: auth.user.id,
        updatedAt: new Date(),
      })
      .where(eq(barberProfiles.userId, id))
  })

  return NextResponse.json({ success: true })
}
