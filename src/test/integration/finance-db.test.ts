import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres, { type Sql } from 'postgres'

const connectionString = process.env.DIRECT_URL
const describeDatabase = connectionString ? describe : describe.skip

describeDatabase('finance PostgreSQL constraints', () => {
  let sql: Sql
  let organizationId: string
  let barberId: string
  let adminId: string

  beforeAll(async () => {
    sql = postgres(connectionString!, { max: 1 })
    const [context] = await sql<{
      organization_id: string
      barber_id: string
      admin_id: string
    }[]>`
      select
        barber.organization_id,
        barber.id as barber_id,
        admin_user.id as admin_id
      from users barber
      join users admin_user
        on admin_user.organization_id = barber.organization_id
        and admin_user.role = 'admin'
        and admin_user.status = 'active'
      where barber.role = 'barber'
        and barber.status = 'active'
      limit 1
    `
    organizationId = context.organization_id
    barberId = context.barber_id
    adminId = context.admin_id
  })

  afterAll(async () => {
    await sql.end()
  })

  it('allows only one open cash session per branch', async () => {
    let errorCode: string | undefined
    try {
      await sql.begin(async (tx) => {
        const [branch] = await tx<{ id: string }[]>`
          insert into branches (organization_id, name)
          values (${organizationId}, 'Finance constraint test')
          returning id
        `
        await tx`
          insert into cash_sessions (
            organization_id,
            branch_id,
            opened_by,
            opening_amount
          )
          values (${organizationId}, ${branch.id}, ${adminId}, 1000.00)
        `
        await tx`
          insert into cash_sessions (
            organization_id,
            branch_id,
            opened_by,
            opening_amount
          )
          values (${organizationId}, ${branch.id}, ${adminId}, 500.00)
        `
      })
    } catch (error) {
      errorCode = (error as { code?: string }).code
    }

    expect(errorCode).toBe('23505')
  })

  it('requires paid sales to include paid_at', async () => {
    let constraint: string | undefined
    try {
      await sql.begin(async (tx) => {
        const [branch] = await tx<{ id: string }[]>`
          insert into branches (organization_id, name)
          values (${organizationId}, 'Paid sale constraint test')
          returning id
        `
        await tx`
          insert into sales (
            organization_id,
            branch_id,
            barber_id,
            subtotal,
            discount,
            total,
            status,
            created_by
          )
          values (
            ${organizationId},
            ${branch.id},
            ${barberId},
            1000.00,
            0.00,
            1000.00,
            'paid',
            ${adminId}
          )
        `
      })
    } catch (error) {
      constraint = (error as { constraint_name?: string }).constraint_name
    }

    expect(constraint).toBe('sales_paid_at_matches_status')
  })

  it('rejects inconsistent cash closing snapshots', async () => {
    let constraint: string | undefined
    try {
      await sql.begin(async (tx) => {
        const [branch] = await tx<{ id: string }[]>`
          insert into branches (organization_id, name)
          values (${organizationId}, 'Cash close constraint test')
          returning id
        `
        const [session] = await tx<{ id: string }[]>`
          insert into cash_sessions (
            organization_id,
            branch_id,
            opened_by,
            opening_amount
          )
          values (${organizationId}, ${branch.id}, ${adminId}, 1000.00)
          returning id
        `
        await tx`
          update cash_sessions
          set
            status = 'closed',
            closed_by = ${adminId},
            closed_at = now(),
            expected_cash = 1000.00,
            expected_transfer = 0.00,
            expected_card = 0.00,
            expected_mercadopago_manual = 0.00,
            expected_other = 0.00,
            expected_total = 1000.00,
            counted_cash = 900.00,
            cash_difference = 0.00
          where id = ${session.id}
        `
      })
    } catch (error) {
      constraint = (error as { constraint_name?: string }).constraint_name
    }

    expect(constraint).toBe('cash_sessions_state_valid')
  })

  it('prevents updates to recorded payments', async () => {
    let errorCode: string | undefined
    try {
      await sql.begin(async (tx) => {
        const [branch] = await tx<{ id: string }[]>`
          insert into branches (organization_id, name)
          values (${organizationId}, 'Immutable payment test')
          returning id
        `
        const [sale] = await tx<{ id: string }[]>`
          insert into sales (
            organization_id,
            branch_id,
            barber_id,
            subtotal,
            discount,
            total,
            status,
            created_by,
            paid_at
          )
          values (
            ${organizationId},
            ${branch.id},
            ${barberId},
            1000.00,
            0.00,
            1000.00,
            'paid',
            ${adminId},
            now()
          )
          returning id
        `
        const [payment] = await tx<{ id: string }[]>`
          insert into payments (
            organization_id,
            sale_id,
            method,
            amount,
            created_by
          )
          values (${organizationId}, ${sale.id}, 'cash', 1000.00, ${adminId})
          returning id
        `
        await tx`update payments set amount = 900.00 where id = ${payment.id}`
      })
    } catch (error) {
      errorCode = (error as { code?: string }).code
    }

    expect(errorCode).toBe('23000')
  })
})
