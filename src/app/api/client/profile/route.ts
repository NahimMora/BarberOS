import { NextResponse } from 'next/server'
import { z } from 'zod'
import { zodErrorMessage } from '@/lib/validation/zod-error'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients } from '@/db/schema'
import { getClientSession } from '@/lib/auth/get-client-session'

// Solo los campos que el propio cliente puede tocar. notes/extraProfile/tags
// son internos del staff — nunca expuestos ni editables acá.
const updateSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().max(255).optional(),
  nickname: z.string().max(100).optional(),
  birthdayDay: z.number().int().min(1).max(31).nullable().optional(),
  birthdayMonth: z.number().int().min(1).max(12).nullable().optional(),
  profession: z.string().max(150).optional(),
})

export async function GET(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await db.select().from(clients).where(eq(clients.id, client.id)).limit(1)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    nickname: row.nickname,
    birthdayDay: row.birthdayDay,
    birthdayMonth: row.birthdayMonth,
    profession: row.profession,
    whatsappE164: row.whatsappE164,
  })
}

export async function PATCH(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  const [row] = await db
    .update(clients)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clients.id, client.id))
    .returning()

  return NextResponse.json({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    nickname: row.nickname,
    birthdayDay: row.birthdayDay,
    birthdayMonth: row.birthdayMonth,
    profession: row.profession,
    whatsappE164: row.whatsappE164,
  })
}
