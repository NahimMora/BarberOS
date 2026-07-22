import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres, { type Sql } from 'postgres'

const connectionString = process.env.DIRECT_URL
const describeDatabase = connectionString ? describe : describe.skip

describeDatabase('appointments PostgreSQL constraints', () => {
  let sql: Sql
  let organizationId: string
  let branchId: string
  let barberId: string
  let adminId: string
  let clientId: string

  beforeAll(async () => {
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

    const [client] = await sql<{ id: string }[]>`
      insert into clients (organization_id, first_name)
      values (${organizationId}, 'Test Client (appointments-db.test.ts)')
      returning id
    `
    clientId = client.id
  })

  afterAll(async () => {
    await sql`delete from clients where id = ${clientId}`
    await sql.end()
  })

  it('rejects overlapping active appointments for the same barber', async () => {
    let errorCode: string | undefined
    try {
      await sql.begin(async (tx) => {
        await tx`
          insert into appointments (
            organization_id,
            branch_id,
            barber_id,
            created_by_user_id,
            status,
            source,
            start_at,
            end_at
          )
          values (
            ${organizationId},
            ${branchId},
            ${barberId},
            ${adminId},
            'scheduled',
            'booked',
            ${new Date('2099-01-15T13:00:00.000Z')},
            ${new Date('2099-01-15T14:00:00.000Z')}
          )
        `
        await tx`
          insert into appointments (
            organization_id,
            branch_id,
            barber_id,
            created_by_user_id,
            status,
            source,
            start_at,
            end_at
          )
          values (
            ${organizationId},
            ${branchId},
            ${barberId},
            ${adminId},
            'confirmed',
            'booked',
            ${new Date('2099-01-15T13:30:00.000Z')},
            ${new Date('2099-01-15T14:30:00.000Z')}
          )
        `
      })
    } catch (error) {
      errorCode = (error as { code?: string }).code
    }

    expect(errorCode).toBe('23P01')
  })

  it('allows a completed appointment to overlap an active appointment', async () => {
    await sql.begin(async (tx) => {
      const active = await tx<{ id: string }[]>`
        insert into appointments (
          organization_id,
          branch_id,
          barber_id,
          created_by_user_id,
          status,
          source,
          start_at,
          end_at
        )
        values (
          ${organizationId},
          ${branchId},
          ${barberId},
          ${adminId},
          'scheduled',
          'booked',
          ${new Date('2099-02-15T13:00:00.000Z')},
          ${new Date('2099-02-15T14:00:00.000Z')}
        )
        returning id
      `
      const completed = await tx<{ id: string }[]>`
        insert into appointments (
          organization_id,
          branch_id,
          barber_id,
          created_by_user_id,
          status,
          source,
          start_at,
          end_at
        )
        values (
          ${organizationId},
          ${branchId},
          ${barberId},
          ${adminId},
          'completed',
          'booked',
          ${new Date('2099-02-15T13:30:00.000Z')},
          ${new Date('2099-02-15T14:30:00.000Z')}
        )
        returning id
      `

      expect(active).toHaveLength(1)
      expect(completed).toHaveLength(1)
      await tx`delete from appointments where id in (${active[0].id}, ${completed[0].id})`
    })
  })

  it('rejects appointments with neither or both created_by columns set', async () => {
    let neitherCode: string | undefined
    try {
      await sql`
        insert into appointments (organization_id, branch_id, barber_id, status, source, start_at, end_at)
        values (${organizationId}, ${branchId}, ${barberId}, 'scheduled', 'booked', ${new Date('2099-03-15T13:00:00.000Z')}, ${new Date('2099-03-15T14:00:00.000Z')})
      `
    } catch (error) {
      neitherCode = (error as { code?: string }).code
    }
    expect(neitherCode).toBe('23514')

    let bothCode: string | undefined
    try {
      await sql`
        insert into appointments (organization_id, branch_id, barber_id, created_by_user_id, created_by_client_id, status, source, start_at, end_at)
        values (${organizationId}, ${branchId}, ${barberId}, ${adminId}, ${clientId}, 'scheduled', 'booked', ${new Date('2099-03-15T13:00:00.000Z')}, ${new Date('2099-03-15T14:00:00.000Z')})
      `
    } catch (error) {
      bothCode = (error as { code?: string }).code
    }
    expect(bothCode).toBe('23514')
  })

  it('a client-created appointment still blocks overlap against a staff-created one', async () => {
    let errorCode: string | undefined
    try {
      await sql.begin(async (tx) => {
        await tx`
          insert into appointments (
            organization_id, branch_id, barber_id, created_by_user_id,
            status, source, start_at, end_at
          )
          values (
            ${organizationId}, ${branchId}, ${barberId}, ${adminId},
            'scheduled', 'booked',
            ${new Date('2099-04-15T13:00:00.000Z')}, ${new Date('2099-04-15T14:00:00.000Z')}
          )
        `
        await tx`
          insert into appointments (
            organization_id, branch_id, barber_id, created_by_client_id, client_id,
            status, source, start_at, end_at
          )
          values (
            ${organizationId}, ${branchId}, ${barberId}, ${clientId}, ${clientId},
            'scheduled', 'booked',
            ${new Date('2099-04-15T13:30:00.000Z')}, ${new Date('2099-04-15T14:30:00.000Z')}
          )
        `
      })
    } catch (error) {
      errorCode = (error as { code?: string }).code
    }

    expect(errorCode).toBe('23P01')
  })
})
