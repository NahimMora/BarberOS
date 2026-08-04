import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import postgres, { type Sql } from 'postgres'

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}))

const connectionString = process.env.DIRECT_URL
const describeDatabase = connectionString ? describe : describe.skip

describeDatabase('POST /api/cron/appointment-reminders', () => {
  let sql: Sql
  let organizationId: string
  let branchId: string
  let barberId: string
  let adminId: string
  let appointmentId: string
  const cronSecret = process.env.CRON_SECRET ?? 'test-cron-secret'

  beforeAll(async () => {
    process.env.CRON_SECRET = cronSecret
    sql = postgres(connectionString!, { max: 1 })
    const [context] = await sql<{
      organization_id: string
      branch_id: string
      barber_id: string
      admin_id: string
    }[]>`
      select
        barber.organization_id,
        user_branches.branch_id,
        barber.id as barber_id,
        admin_user.id as admin_id
      from users barber
      join user_branches on user_branches.user_id = barber.id
      join users admin_user
        on admin_user.organization_id = barber.organization_id
        and admin_user.role = 'admin'
        and admin_user.status = 'active'
      where barber.role = 'barber'
        and barber.status = 'active'
      limit 1
    `
    organizationId = context.organization_id
    branchId = context.branch_id
    barberId = context.barber_id
    adminId = context.admin_id

    const startAt = new Date(Date.now() + 30 * 60_000)
    const endAt = new Date(startAt.getTime() + 30 * 60_000)
    const [appointment] = await sql<{ id: string }[]>`
      insert into appointments (
        organization_id, branch_id, barber_id, created_by_user_id,
        status, source, start_at, end_at
      )
      values (
        ${organizationId}, ${branchId}, ${barberId}, ${adminId},
        'scheduled', 'booked', ${startAt}, ${endAt}
      )
      returning id
    `
    appointmentId = appointment.id
  })

  afterAll(async () => {
    await sql`delete from appointments where id = ${appointmentId}`
    await sql.end()
  })

  it('rejects requests without the cron secret', async () => {
    const { POST } = await import('@/app/api/cron/appointment-reminders/route')
    const res = await POST(new Request('http://localhost/api/cron/appointment-reminders', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('sends a reminder for an appointment starting in 30 minutes and marks it sent', async () => {
    const { POST } = await import('@/app/api/cron/appointment-reminders/route')
    const res = await POST(new Request('http://localhost/api/cron/appointment-reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { remindersSent: number }
    expect(body.remindersSent).toBeGreaterThanOrEqual(1)

    const [row] = await sql<{ reminder_sent_at: Date | null }[]>`
      select reminder_sent_at from appointments where id = ${appointmentId}
    `
    expect(row.reminder_sent_at).not.toBeNull()
  })

  it('does not resend a reminder that was already sent (idempotent)', async () => {
    const [before] = await sql<{ reminder_sent_at: Date }[]>`
      select reminder_sent_at from appointments where id = ${appointmentId}
    `

    const { POST } = await import('@/app/api/cron/appointment-reminders/route')
    await POST(new Request('http://localhost/api/cron/appointment-reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    }))

    const [after] = await sql<{ reminder_sent_at: Date }[]>`
      select reminder_sent_at from appointments where id = ${appointmentId}
    `
    // El segundo run no debería tocar de nuevo este turno — mismo timestamp.
    expect(after.reminder_sent_at.getTime()).toBe(before.reminder_sent_at.getTime())
  })
})
