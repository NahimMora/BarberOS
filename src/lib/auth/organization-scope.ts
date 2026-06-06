import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { branches, userBranches, users } from '@/db/schema'

export async function branchesBelongToOrganization(
  organizationId: string,
  branchIds: string[],
): Promise<boolean> {
  const uniqueIds = [...new Set(branchIds)]
  if (uniqueIds.length === 0) return true

  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.organizationId, organizationId),
        inArray(branches.id, uniqueIds),
        isNull(branches.deletedAt),
      ),
    )
  return rows.length === uniqueIds.length
}

export async function barberBelongsToBranch(
  organizationId: string,
  barberId: string,
  branchId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(
      userBranches,
      and(
        eq(userBranches.userId, users.id),
        eq(userBranches.branchId, branchId),
        eq(userBranches.organizationId, organizationId),
      ),
    )
    .where(
      and(
        eq(users.id, barberId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'barber'),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)
  return Boolean(row)
}
