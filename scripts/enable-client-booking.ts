// One-time operational toggle: turns on organization_settings.client_booking_enabled
// so the client mobile app (app-BarberOS) can create appointments directly
// (POST /api/client/appointments starts returning 403 otherwise — see
// src/app/api/client/appointments/route.ts). No admin UI exists for this
// setting yet, so this script is the only way to flip it.
//
// Aborts instead of guessing if there's more than one organization — pass
// TARGET_ORG_NAME to disambiguate.
//
// Usage:
//   npx tsx --env-file=.env.production.local scripts/enable-client-booking.ts

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { organizations, organizationSettings } from '../src/db/schema'

const DATABASE_URL = process.env.DATABASE_URL
const TARGET_ORG_NAME = process.env.TARGET_ORG_NAME

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL', DATABASE_URL)
  const sql = postgres(databaseUrl)
  const db = drizzle(sql)

  const allOrgs = await db.select().from(organizations)
  if (allOrgs.length === 0) throw new Error('No organizations found')

  let org = allOrgs[0]
  if (allOrgs.length > 1) {
    if (!TARGET_ORG_NAME) {
      throw new Error(
        `Found ${allOrgs.length} organizations, set TARGET_ORG_NAME to pick one: ${allOrgs.map((o) => o.name).join(', ')}`,
      )
    }
    const match = allOrgs.find((o) => o.name === TARGET_ORG_NAME)
    if (!match) throw new Error(`Organization "${TARGET_ORG_NAME}" not found`)
    org = match
  }

  const [settings] = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, org.id))
    .limit(1)
  if (!settings) throw new Error(`No organization_settings row for organization "${org.name}"`)

  console.log(`Organization: ${org.name} (${org.id})`)
  console.log(`client_booking_enabled: ${settings.clientBookingEnabled} -> true`)

  if (settings.clientBookingEnabled) {
    console.log('Already enabled — nothing to do.')
    await sql.end()
    return
  }

  await db
    .update(organizationSettings)
    .set({ clientBookingEnabled: true, updatedAt: new Date() })
    .where(eq(organizationSettings.organizationId, org.id))

  console.log('Done. Clients can now self-book from the app.')
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
