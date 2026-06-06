import { NextResponse } from 'next/server'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { barberProfiles, branches, userBranches, users } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const branchConditions = [
    eq(branches.organizationId, user.organizationId),
    eq(branches.active, true),
    isNull(branches.deletedAt),
  ]
  if (user.role !== 'admin') {
    if (user.branchIds.length === 0) {
      return NextResponse.json({ user, branches: [], barbers: [] })
    }
    branchConditions.push(inArray(branches.id, user.branchIds))
  }

  const branchRows = await db
    .select({
      id: branches.id,
      name: branches.name,
      timezone: branches.timezone,
    })
    .from(branches)
    .where(and(...branchConditions))
    .orderBy(branches.name)

  const accessibleBranchIds = branchRows.map((branch) => branch.id)
  if (accessibleBranchIds.length === 0) {
    return NextResponse.json({ user, branches: branchRows, barbers: [] })
  }

  const barberRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      branchId: userBranches.branchId,
      displayColor: barberProfiles.displayColor,
    })
    .from(users)
    .innerJoin(userBranches, eq(userBranches.userId, users.id))
    .leftJoin(barberProfiles, eq(barberProfiles.userId, users.id))
    .where(
      and(
        eq(users.organizationId, user.organizationId),
        eq(users.role, 'barber'),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
        inArray(userBranches.branchId, accessibleBranchIds),
      ),
    )
    .orderBy(users.fullName)

  return NextResponse.json({
    user,
    branches: branchRows,
    barbers: barberRows,
  })
}
