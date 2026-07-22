import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, userBranches } from '@/db/schema'
import { getClientSession } from '@/lib/auth/get-client-session'

export async function GET(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branch_id')
  if (!branchId) {
    return NextResponse.json({ error: 'branch_id es requerido' }, { status: 400 })
  }

  const rows = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .innerJoin(userBranches, and(eq(userBranches.userId, users.id), eq(userBranches.branchId, branchId)))
    .where(
      and(
        eq(users.organizationId, client.organizationId),
        eq(users.role, 'barber'),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(users.fullName)

  return NextResponse.json(rows)
}
