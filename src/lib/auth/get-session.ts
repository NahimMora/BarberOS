import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type AppUser = {
  id: string
  authId: string
  organizationId: string
  role: 'admin' | 'receptionist' | 'barber'
  status: 'active' | 'invited' | 'disabled'
  fullName: string
  email: string
}

export async function getSession(): Promise<AppUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [appUser] = await db
    .select()
    .from(users)
    .where(eq(users.authId, user.id))
    .limit(1)

  if (!appUser) return null

  return {
    id: appUser.id,
    authId: appUser.authId,
    organizationId: appUser.organizationId,
    role: appUser.role,
    status: appUser.status,
    fullName: appUser.fullName,
    email: appUser.email,
  }
}
