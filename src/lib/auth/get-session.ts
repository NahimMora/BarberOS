import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { userBranches, users } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

export type AppUser = {
  id: string
  authId: string
  organizationId: string
  role: 'admin' | 'receptionist' | 'barber'
  status: 'active' | 'invited' | 'disabled'
  fullName: string
  email: string
  branchIds: string[]
}

export async function getSession(): Promise<AppUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [appUser] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.authId, user.id),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)

  if (!appUser) return null
  const branchRows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.userId, appUser.id))

  return {
    id: appUser.id,
    authId: appUser.authId,
    organizationId: appUser.organizationId,
    role: appUser.role,
    status: appUser.status,
    fullName: appUser.fullName,
    email: appUser.email,
    branchIds: branchRows.map((row) => row.branchId),
  }
}
