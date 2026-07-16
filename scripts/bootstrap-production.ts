// One-time bootstrap for a brand-new production Supabase project: creates
// exactly one organization and one real admin account, nothing else. Run
// once against production env vars, then log in and configure branches,
// staff, services, and clients from the app itself (Operación).
//
// Required env vars (set in .env.production.local, never committed):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DIRECT_URL
//   BOOTSTRAP_ORG_NAME, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD
//
// Usage (Node's built-in --env-file, no extra dependency needed):
//   npx tsx --env-file=.env.production.local scripts/bootstrap-production.ts

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { organizations, organizationSettings, users } from '../src/db/schema'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DIRECT_URL = process.env.DIRECT_URL
const ORG_NAME = process.env.BOOTSTRAP_ORG_NAME
const ADMIN_NAME = process.env.BOOTSTRAP_ADMIN_NAME
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL)
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY)
  const directUrl = requireEnv('DIRECT_URL', DIRECT_URL)
  const orgName = requireEnv('BOOTSTRAP_ORG_NAME', ORG_NAME)
  const adminName = requireEnv('BOOTSTRAP_ADMIN_NAME', ADMIN_NAME)
  const adminEmail = requireEnv('BOOTSTRAP_ADMIN_EMAIL', ADMIN_EMAIL)
  const adminPassword = requireEnv('BOOTSTRAP_ADMIN_PASSWORD', ADMIN_PASSWORD)

  if (adminPassword.length < 8) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters')
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const sql = postgres(directUrl)
  const db = drizzle(sql)

  console.log(`Bootstrapping production org "${orgName}"...\n`)

  let [org] = await db.select().from(organizations).where(eq(organizations.name, orgName)).limit(1)
  if (!org) {
    ;[org] = await db.insert(organizations).values({ name: orgName }).returning()
    console.log(`Created organization: ${orgName}`)
  } else {
    console.log(`Organization already exists: ${orgName}`)
  }

  const [existingSettings] = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, org.id))
    .limit(1)

  if (!existingSettings) {
    await db.insert(organizationSettings).values({ organizationId: org.id })
    console.log('Created organization settings (defaults: ARS, America/Argentina/Buenos_Aires, 25% commission)')
  } else {
    console.log('Organization settings already exist')
  }

  const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
  let authId = existingAuthUsers?.users?.find((u) => u.email === adminEmail)?.id

  if (!authId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName },
    })
    if (error) throw new Error(`Failed to create auth user ${adminEmail}: ${error.message}`)
    authId = data.user.id
    console.log(`Created auth user: ${adminEmail}`)
  } else {
    console.log(`Auth user already exists: ${adminEmail}`)
  }

  const [existingAppUser] = await db.select().from(users).where(eq(users.authId, authId)).limit(1)
  if (!existingAppUser) {
    await db.insert(users).values({
      organizationId: org.id,
      authId,
      fullName: adminName,
      email: adminEmail,
      role: 'admin',
      status: 'active',
    })
    console.log(`Created admin user: ${adminEmail}`)
  } else {
    console.log(`App user already exists: ${adminEmail}`)
  }

  console.log('\nDone. Log in with the admin email/password above and configure branches, staff, services, and clients from Operación.')
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
