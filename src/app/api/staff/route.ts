import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { barberProfiles, branches, userBranches, users } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { branchesBelongToOrganization } from '@/lib/auth/organization-scope'

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'receptionist', 'barber']),
  branchIds: z.array(z.string().uuid()).default([]),
  commissionRate: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).nullable().optional(),
})

async function requireAdmin() {
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
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const rows = await db
    .select({
      id: users.id,
      authId: users.authId,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      status: users.status,
      branchId: userBranches.branchId,
      branchName: branches.name,
      commissionRate: barberProfiles.commissionRate,
    })
    .from(users)
    .leftJoin(userBranches, eq(userBranches.userId, users.id))
    .leftJoin(branches, eq(branches.id, userBranches.branchId))
    .leftJoin(barberProfiles, eq(barberProfiles.userId, users.id))
    .where(
      and(
        eq(users.organizationId, auth.user.organizationId),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(users.fullName)

  const grouped = new Map<string, {
    id: string
    fullName: string
    email: string
    role: typeof users.$inferSelect.role
    status: typeof users.$inferSelect.status
    commissionRate: string | null
    branches: { id: string; name: string }[]
  }>()
  for (const row of rows) {
    const staff = grouped.get(row.id) ?? {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      role: row.role,
      status: row.status,
      commissionRate: row.commissionRate,
      branches: [],
    }
    if (row.branchId && row.branchName) {
      staff.branches.push({ id: row.branchId, name: row.branchName })
    }
    grouped.set(row.id, staff)
  }

  return NextResponse.json([...grouped.values()])
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data
  if (input.role !== 'admin' && input.branchIds.length === 0) {
    return NextResponse.json({ error: 'Debe asignar al menos una sucursal' }, { status: 400 })
  }
  if (!(await branchesBelongToOrganization(auth.user.organizationId, input.branchIds))) {
    return NextResponse.json({ error: 'Una o más sucursales no son válidas' }, { status: 400 })
  }

  const supabaseAdmin = createSupabaseAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: {
      organization_id: auth.user.organizationId,
      role: input.role,
    },
    user_metadata: { full_name: input.fullName },
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [staff] = await tx
        .insert(users)
        .values({
          organizationId: auth.user.organizationId,
          authId: data.user.id,
          fullName: input.fullName,
          email: input.email,
          role: input.role,
          status: 'active',
        })
        .returning()

      if (input.branchIds.length > 0) {
        await tx.insert(userBranches).values(
          input.branchIds.map((branchId) => ({
            organizationId: auth.user.organizationId,
            userId: staff.id,
            branchId,
          })),
        )
      }
      if (input.role === 'barber') {
        await tx.insert(barberProfiles).values({
          organizationId: auth.user.organizationId,
          userId: staff.id,
          commissionRate: input.commissionRate ?? null,
        })
      }
      return staff
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    throw error
  }
}
