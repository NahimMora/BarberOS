import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { zodErrorMessage } from '@/lib/validation/zod-error'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  const { endpoint, keys } = parsed.data
  const userAgent = req.headers.get('user-agent') ?? undefined

  await db
    .insert(pushSubscriptions)
    .values({
      organizationId: user.organizationId,
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      authKey: keys.auth,
      userAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        organizationId: user.organizationId,
        userId: user.id,
        p256dh: keys.p256dh,
        authKey: keys.auth,
        userAgent,
      },
    })

  return NextResponse.json({ subscribed: true }, { status: 201 })
}

export async function DELETE(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = unsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  await db
    .delete(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.endpoint, parsed.data.endpoint),
      eq(pushSubscriptions.userId, user.id),
    ))

  return NextResponse.json({ subscribed: false })
}
