import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import postgres, { type Sql } from 'postgres'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/db/schema'

const connectionString = process.env.DIRECT_URL
const describeDatabase = connectionString ? describe : describe.skip

describeDatabase('push_subscriptions upsert/scoped delete (POST/DELETE /api/notifications/subscribe logic)', () => {
  let sql: Sql
  let organizationId: string
  let barberId: string
  let otherUserId: string
  const endpoint = `https://push.example.com/test-${Date.now()}`

  beforeAll(async () => {
    sql = postgres(connectionString!, { max: 1 })
    const [context] = await sql<{
      organization_id: string
      barber_id: string
      other_user_id: string
    }[]>`
      select
        barber.organization_id,
        barber.id as barber_id,
        admin_user.id as other_user_id
      from users barber
      join users admin_user
        on admin_user.organization_id = barber.organization_id
        and admin_user.role = 'admin'
        and admin_user.status = 'active'
        and admin_user.id <> barber.id
      where barber.role = 'barber'
        and barber.status = 'active'
      limit 1
    `
    organizationId = context.organization_id
    barberId = context.barber_id
    otherUserId = context.other_user_id
  })

  afterAll(async () => {
    await sql`delete from push_subscriptions where endpoint = ${endpoint}`
    await sql.end()
  })

  it('upserts by endpoint instead of creating duplicates on re-subscribe', async () => {
    await db.insert(pushSubscriptions).values({
      organizationId,
      userId: barberId,
      endpoint,
      p256dh: 'key-1',
      authKey: 'auth-1',
    }).onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { organizationId, userId: barberId, p256dh: 'key-1', authKey: 'auth-1' },
    })

    // Mismo endpoint, browser resuscribió con claves nuevas (comportamiento
    // real de PushManager.subscribe si el navegador rota el endpoint).
    await db.insert(pushSubscriptions).values({
      organizationId,
      userId: barberId,
      endpoint,
      p256dh: 'key-2',
      authKey: 'auth-2',
    }).onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { organizationId, userId: barberId, p256dh: 'key-2', authKey: 'auth-2' },
    })

    const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
    expect(rows).toHaveLength(1)
    expect(rows[0].p256dh).toBe('key-2')
  })

  it('does not delete a subscription when the requesting user does not own it', async () => {
    await db.delete(pushSubscriptions).where(and(
      eq(pushSubscriptions.endpoint, endpoint),
      eq(pushSubscriptions.userId, otherUserId),
    ))

    const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
    expect(rows).toHaveLength(1)
  })

  it('deletes the subscription when the owning user requests it', async () => {
    await db.delete(pushSubscriptions).where(and(
      eq(pushSubscriptions.endpoint, endpoint),
      eq(pushSubscriptions.userId, barberId),
    ))

    const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
    expect(rows).toHaveLength(0)
  })
})
