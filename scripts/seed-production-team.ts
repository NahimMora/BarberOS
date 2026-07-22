// One-time follow-up to bootstrap-production.ts: adds a branch, a starter
// service menu, and one placeholder barber + receptionist account so the
// app has something coherent to show. Placeholder accounts use the admin's
// own email with +alias addressing (mail actually reaches the admin) and a
// temporary password — meant to be replaced with the real team's data from
// Operación once confirmed, not to stay long-term.
//
// Requires bootstrap-production.ts to have already run (reads the org by
// BOOTSTRAP_ORG_NAME).
//
// Usage:
//   npx tsx --env-file=.env.production.local scripts/seed-production-team.ts

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and } from 'drizzle-orm'
import { organizations, branches, users, userBranches, barberProfiles, services } from '../src/db/schema'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL
const ORG_NAME = process.env.BOOTSTRAP_ORG_NAME
const PLACEHOLDER_PASSWORD = process.env.TEAM_PLACEHOLDER_PASSWORD ?? 'CambiarAhora2026!'

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

const workingHours = {
  mon: { open: '09:00', close: '20:00' },
  tue: { open: '09:00', close: '20:00' },
  wed: { open: '09:00', close: '20:00' },
  thu: { open: '09:00', close: '20:00' },
  fri: { open: '09:00', close: '20:00' },
  sat: { open: '09:00', close: '20:00' },
  sun: null,
}

const serviceSeed = [
  { name: 'Corte', durationMinutes: 30, price: '3500.00' },
  { name: 'Corte + Barba', durationMinutes: 45, price: '5000.00' },
  { name: 'Barba', durationMinutes: 20, price: '2000.00' },
  { name: 'Delineado', durationMinutes: 15, price: '1500.00' },
]

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL)
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY)
  const databaseUrl = requireEnv('DATABASE_URL', DATABASE_URL)
  const orgName = requireEnv('BOOTSTRAP_ORG_NAME', ORG_NAME)

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const sql = postgres(databaseUrl)
  const db = drizzle(sql)

  const [org] = await db.select().from(organizations).where(eq(organizations.name, orgName)).limit(1)
  if (!org) throw new Error(`Organization "${orgName}" not found — run bootstrap-production.ts first`)

  // Branch
  const branchName = `${orgName} · Sucursal Principal`
  let [branch] = await db.select().from(branches).where(eq(branches.name, branchName)).limit(1)
  if (!branch) {
    ;[branch] = await db.insert(branches).values({
      organizationId: org.id,
      name: branchName,
      address: 'Completar dirección real desde Operación',
      workingHours,
    }).returning()
    console.log(`Created branch: ${branchName}`)
  } else {
    console.log(`Branch already exists: ${branchName}`)
  }

  // Services
  for (const s of serviceSeed) {
    const [existing] = await db
      .select()
      .from(services)
      .where(and(eq(services.organizationId, org.id), eq(services.name, s.name)))
      .limit(1)
    if (!existing) {
      await db.insert(services).values({ organizationId: org.id, ...s })
      console.log(`Created service: ${s.name} — $${s.price}`)
    } else {
      console.log(`Service already exists: ${s.name}`)
    }
  }

  // Placeholder team
  const team = [
    { email: 'nahimsalta+barbero@gmail.com', fullName: 'Emiliano Torres', role: 'barber' as const },
    { email: 'nahimsalta+recepcion@gmail.com', fullName: 'Camila Rodríguez', role: 'receptionist' as const },
  ]

  for (const member of team) {
    console.log(`\nProcessing ${member.role}: ${member.email}`)

    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
    let authId = existingAuthUsers?.users?.find((u) => u.email === member.email)?.id

    if (!authId) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: member.email,
        password: PLACEHOLDER_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: member.fullName },
      })
      if (error) throw new Error(`Failed to create auth user ${member.email}: ${error.message}`)
      authId = data.user.id
      console.log(`  Created auth user`)
    } else {
      console.log(`  Auth user already exists`)
    }

    let [appUser] = await db.select().from(users).where(eq(users.authId, authId)).limit(1)
    if (!appUser) {
      ;[appUser] = await db.insert(users).values({
        organizationId: org.id,
        authId,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        status: 'active',
      }).returning()
      console.log(`  Created app user: ${member.fullName}`)
    } else {
      console.log(`  App user already exists`)
    }

    const [existingAssignment] = await db
      .select()
      .from(userBranches)
      .where(and(eq(userBranches.userId, appUser.id), eq(userBranches.branchId, branch.id)))
      .limit(1)
    if (!existingAssignment) {
      await db.insert(userBranches).values({ organizationId: org.id, userId: appUser.id, branchId: branch.id })
      console.log(`  Assigned to ${branchName}`)
    }

    if (member.role === 'barber') {
      const [existingProfile] = await db
        .select()
        .from(barberProfiles)
        .where(eq(barberProfiles.userId, appUser.id))
        .limit(1)
      if (!existingProfile) {
        await db.insert(barberProfiles).values({
          userId: appUser.id,
          organizationId: org.id,
          commissionRate: '25.00',
          displayColor: '#6366f1',
        })
        console.log(`  Created barber profile (25% commission)`)
      }
    }
  }

  console.log(`\nDone. Placeholder team password: ${PLACEHOLDER_PASSWORD} (change it — these are stand-ins, replace with the real team's data from Operación when confirmed).`)
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
