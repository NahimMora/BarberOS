import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import {
  organizations,
  organizationSettings,
  branches,
  users,
  userBranches,
  barberProfiles,
} from '../src/db/schema'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DIRECT_URL = process.env.DIRECT_URL!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sql = postgres(DIRECT_URL)
const db = drizzle(sql)

const DEMO_USERS = [
  { email: 'admin@demo.com', fullName: 'Admin Demo', role: 'admin' as const },
  { email: 'recep@demo.com', fullName: 'Recepcionista Demo', role: 'receptionist' as const },
  { email: 'barbero@demo.com', fullName: 'Barbero Demo', role: 'barber' as const },
]

const DEFAULT_PASSWORD = 'demo1234'

async function upsertAuthUser(email: string, fullName: string) {
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === email)

  if (found) {
    console.log(`  Auth user exists: ${email}`)
    return found.id
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`)
  console.log(`  Created auth user: ${email}`)
  return data.user.id
}

async function main() {
  console.log('Seeding BarberOS demo data...\n')

  // 1. Organization
  let [org] = await db.select().from(organizations).where(eq(organizations.name, 'Barbería Demo')).limit(1)
  if (!org) {
    ;[org] = await db.insert(organizations).values({ name: 'Barbería Demo' }).returning()
    console.log('Created organization: Barbería Demo')
  } else {
    console.log('Organization exists: Barbería Demo')
  }

  // 2. Organization settings
  const [existingSettings] = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, org.id))
    .limit(1)

  if (!existingSettings) {
    await db.insert(organizationSettings).values({
      organizationId: org.id,
      currency: 'ARS',
      defaultTimezone: 'America/Argentina/Buenos_Aires',
      slotIntervalMinutes: 30,
      defaultAppointmentBufferMinutes: 5,
      defaultCommissionRate: '25.00',
      allowBarberCharge: true,
      allowAnonymousWalkin: true,
    })
    console.log('Created organization settings')
  } else {
    console.log('Organization settings exist')
  }

  // 3. Branches
  const workingHours = {
    mon: { open: '09:00', close: '20:00' },
    tue: { open: '09:00', close: '20:00' },
    wed: { open: '09:00', close: '20:00' },
    thu: { open: '09:00', close: '20:00' },
    fri: { open: '09:00', close: '20:00' },
    sat: { open: '09:00', close: '20:00' },
    sun: null,
  }

  const branchSeed = [
    { name: 'Centro', address: 'Av. Central 123' },
    { name: 'Norte', address: 'Calle Norte 456' },
  ]

  const branchIds: Record<string, string> = {}
  for (const b of branchSeed) {
    const [existing] = await db
      .select()
      .from(branches)
      .where(eq(branches.name, b.name))
      .limit(1)

    if (existing) {
      branchIds[b.name] = existing.id
      console.log(`Branch exists: ${b.name}`)
    } else {
      const [created] = await db.insert(branches).values({
        organizationId: org.id,
        name: b.name,
        address: b.address,
        workingHours,
      }).returning()
      branchIds[b.name] = created.id
      console.log(`Created branch: ${b.name}`)
    }
  }

  // 4. Users
  const userIds: Record<string, string> = {}
  for (const u of DEMO_USERS) {
    console.log(`\nProcessing user: ${u.email}`)
    const authId = await upsertAuthUser(u.email, u.fullName)

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authId))
      .limit(1)

    if (existing) {
      userIds[u.email] = existing.id
      console.log(`  App user exists: ${u.email}`)
    } else {
      const [created] = await db.insert(users).values({
        organizationId: org.id,
        authId,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        status: 'active',
      }).returning()
      userIds[u.email] = created.id
      console.log(`  Created app user: ${u.email}`)
    }

    // Barber profile for barbers
    if (u.role === 'barber') {
      const userId = userIds[u.email]
      const [existingProfile] = await db
        .select()
        .from(barberProfiles)
        .where(eq(barberProfiles.userId, userId))
        .limit(1)

      if (!existingProfile) {
        await db.insert(barberProfiles).values({
          userId,
          organizationId: org.id,
          commissionRate: '25.00',
          displayColor: '#6366f1',
        })
        console.log(`  Created barber profile for: ${u.email}`)
      }
    }
  }

  // 5. user_branches
  console.log('\nSetting up user branches...')
  const assignBranch = async (email: string, branchName: string) => {
    const userId = userIds[email]
    const branchId = branchIds[branchName]
    if (!userId || !branchId) return

    const [existing] = await db
      .select()
      .from(userBranches)
      .where(eq(userBranches.userId, userId))
      .limit(1)

    if (!existing) {
      await db.insert(userBranches).values({ userId, branchId })
      console.log(`  Assigned ${email} → ${branchName}`)
    } else {
      console.log(`  Branch already assigned: ${email}`)
    }
  }

  await assignBranch('barbero@demo.com', 'Centro')
  await assignBranch('recep@demo.com', 'Centro')

  console.log('\nSeed completed successfully.')
  await sql.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
