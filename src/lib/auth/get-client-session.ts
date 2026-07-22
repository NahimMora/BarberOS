import { db } from '@/lib/db'
import { clients } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type ClientSession = {
  id: string
  organizationId: string
  authUserId: string
  firstName: string | null
  lastName: string | null
  whatsappE164: string | null
}

// Sesión de la APP de clientes — separado de getSession() (staff, cookie
// based). La APP habla HTTP puro, no tiene cookies de Next.js: manda el JWT
// de Supabase Auth por header, acá lo validamos y resolvemos contra
// `clients.auth_user_id`, nunca contra `users` (staff).
export async function getClientSession(req: Request): Promise<ClientSession | null> {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  const supabaseAdmin = createSupabaseAdminClient()
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null

  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.authUserId, data.user.id),
        eq(clients.active, true),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1)

  if (!client) return null

  return {
    id: client.id,
    organizationId: client.organizationId,
    authUserId: data.user.id,
    firstName: client.firstName,
    lastName: client.lastName,
    whatsappE164: client.whatsappE164,
  }
}

// Usado solo por POST /api/client/register, donde todavía no existe una
// fila en `clients` vinculada — necesita el auth.users crudo (con
// phone/phone_confirmed_at) para poder crearla o vincularla.
export async function getSupabaseAuthUser(req: Request) {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  const supabaseAdmin = createSupabaseAdminClient()
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
