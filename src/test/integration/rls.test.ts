import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres, { type Sql } from 'postgres'

const connectionString = process.env.DIRECT_URL
// Unlike the other src/test/integration/*.test.ts files, this one is
// gated on CI too, not just DIRECT_URL: it inserts fixture rows outside a
// rolled-back transaction (so it doesn't leave leftovers in the ephemeral
// CI database, but would in a real Supabase project), and its
// service_role assertion depends on scripts/ci/grant-service-role.sql,
// which only runs in CI — a real Supabase project provisions service_role
// differently and doesn't have those extra grants.
const describeDatabase = connectionString && process.env.CI ? describe : describe.skip

// Verifies that Postgres RLS actually blocks cross-organization access —
// not just that policies exist. Runs only in CI, against the ephemeral
// database scripts/ci/bootstrap-rls-roles.sql and
// scripts/ci/grant-service-role.sql provision (roles, auth.uid(), and
// service_role grants that a real Supabase project already has built in).
describeDatabase('row level security', () => {
  let sql: Sql
  let orgAId: string
  let orgBId: string
  let adminAAuthId: string
  let adminAId: string
  let barberAAuthId: string
  let barberAId: string
  let branchAId: string
  let branchBId: string
  let clientAAuthId: string
  let clientAId: string
  let otherClientId: string
  let clientAAppointmentId: string
  let otherAppointmentId: string

  beforeAll(async () => {
    sql = postgres(connectionString!, { max: 1 })

    const [orgA] = await sql<{ id: string }[]>`
      insert into organizations (name) values ('RLS test org A') returning id
    `
    const [orgB] = await sql<{ id: string }[]>`
      insert into organizations (name) values ('RLS test org B') returning id
    `
    orgAId = orgA.id
    orgBId = orgB.id

    const [adminA] = await sql<{ id: string; auth_id: string }[]>`
      insert into users (organization_id, auth_id, full_name, email, role, status)
      values (${orgAId}, gen_random_uuid(), 'Admin A', 'rls-admin-a@test.local', 'admin', 'active')
      returning id, auth_id
    `
    const [barberA] = await sql<{ id: string; auth_id: string }[]>`
      insert into users (organization_id, auth_id, full_name, email, role, status)
      values (${orgAId}, gen_random_uuid(), 'Barber A', 'rls-barber-a@test.local', 'barber', 'active')
      returning id, auth_id
    `
    await sql`
      insert into users (organization_id, auth_id, full_name, email, role, status)
      values (${orgBId}, gen_random_uuid(), 'Admin B', 'rls-admin-b@test.local', 'admin', 'active')
    `
    adminAId = adminA.id
    adminAAuthId = adminA.auth_id
    barberAAuthId = barberA.auth_id
    barberAId = barberA.id

    const [branchA] = await sql<{ id: string }[]>`
      insert into branches (organization_id, name) values (${orgAId}, 'Branch A') returning id
    `
    const [branchB] = await sql<{ id: string }[]>`
      insert into branches (organization_id, name) values (${orgBId}, 'Branch B') returning id
    `
    branchAId = branchA.id
    branchBId = branchB.id

    const [clientA] = await sql<{ id: string; auth_user_id: string }[]>`
      insert into clients (organization_id, first_name, auth_user_id)
      values (${orgAId}, 'Client A', gen_random_uuid())
      returning id, auth_user_id
    `
    clientAId = clientA.id
    clientAAuthId = clientA.auth_user_id

    const [otherClient] = await sql<{ id: string }[]>`
      insert into clients (organization_id, first_name) values (${orgAId}, 'Other Client') returning id
    `
    otherClientId = otherClient.id

    const [clientAAppointment] = await sql<{ id: string }[]>`
      insert into appointments (
        organization_id, branch_id, barber_id, client_id, created_by_client_id,
        status, source, start_at, end_at
      )
      values (
        ${orgAId}, ${branchAId}, ${barberAId}, ${clientAId}, ${clientAId},
        'scheduled', 'booked',
        '2099-05-01T13:00:00.000Z', '2099-05-01T14:00:00.000Z'
      )
      returning id
    `
    clientAAppointmentId = clientAAppointment.id

    const [otherAppointment] = await sql<{ id: string }[]>`
      insert into appointments (
        organization_id, branch_id, barber_id, client_id, created_by_user_id,
        status, source, start_at, end_at
      )
      values (
        ${orgAId}, ${branchAId}, ${barberAId}, ${otherClientId}, ${adminAId},
        'scheduled', 'booked',
        '2099-05-02T13:00:00.000Z', '2099-05-02T14:00:00.000Z'
      )
      returning id
    `
    otherAppointmentId = otherAppointment.id
  })

  afterAll(async () => {
    await sql`delete from appointments where id in (${clientAAppointmentId}, ${otherAppointmentId})`
    await sql`delete from clients where id in (${clientAId}, ${otherClientId})`
    await sql.end()
  })

  it('users_read_own: an authenticated user only sees their own row', async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${adminAAuthId}, true)`
      await tx`set local role authenticated`
      return tx<{ id: string }[]>`select id from users`
    })

    expect(rows.map((row) => row.id)).toEqual([adminAId])
  })

  it('branches_select_scoped: an org admin sees only their org\'s branches', async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${adminAAuthId}, true)`
      await tx`set local role authenticated`
      return tx<{ id: string }[]>`select id from branches`
    })

    const ids = rows.map((row) => row.id)
    expect(ids).toContain(branchAId)
    expect(ids).not.toContain(branchBId)
  })

  it('branches_select_scoped: a non-admin without branch membership sees no branches', async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${barberAAuthId}, true)`
      await tx`set local role authenticated`
      return tx<{ id: string }[]>`select id from branches`
    })

    expect(rows).toEqual([])
  })

  it('clients_select_self: a client sees only their own client row', async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${clientAAuthId}, true)`
      await tx`set local role authenticated`
      return tx<{ id: string }[]>`select id from clients`
    })

    expect(rows.map((row) => row.id)).toEqual([clientAId])
  })

  it('appointments_select_self: a client sees only their own appointments', async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${clientAAuthId}, true)`
      await tx`set local role authenticated`
      return tx<{ id: string }[]>`select id from appointments`
    })

    const ids = rows.map((row) => row.id)
    expect(ids).toContain(clientAAppointmentId)
    expect(ids).not.toContain(otherAppointmentId)
  })

  it('service_role bypasses RLS entirely', async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`set local role service_role`
      return tx<{ organization_id: string }[]>`
        select organization_id from users where organization_id in (${orgAId}, ${orgBId})
      `
    })

    const orgIds = new Set(rows.map((row) => row.organization_id))
    expect(orgIds).toEqual(new Set([orgAId, orgBId]))
  })
})
