import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and } from 'drizzle-orm'
import {
  organizations,
  organizationSettings,
  branches,
  users,
  userBranches,
  barberProfiles,
  services,
  clients,
  barberSchedules,
  appointments,
  appointmentServices,
  appointmentHistory,
} from '../src/db/schema'
import { normalizePhone } from '../src/lib/phone/normalize'

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

function futureDate(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d
}

function pastDate(daysAgo: number, hour: number, minute = 0): Date {
  return futureDate(-daysAgo, hour, minute)
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

  // --- FASE 1 DATA ---

  const barberoId = userIds['barbero@demo.com']
  const adminId = userIds['admin@demo.com']
  const centroBranchId = branchIds['Centro']

  // 6. Services
  console.log('\nSeeding services...')
  const serviceSeed = [
    { name: 'Corte', durationMinutes: 30, price: '3500.00' },
    { name: 'Corte + Barba', durationMinutes: 45, price: '5000.00' },
    { name: 'Barba', durationMinutes: 20, price: '2000.00' },
    { name: 'Delineado', durationMinutes: 15, price: '1500.00' },
  ]

  const serviceIds: Record<string, string> = {}
  for (const s of serviceSeed) {
    const [existing] = await db
      .select()
      .from(services)
      .where(and(eq(services.organizationId, org.id), eq(services.name, s.name)))
      .limit(1)

    if (existing) {
      serviceIds[s.name] = existing.id
      console.log(`  Service exists: ${s.name}`)
    } else {
      const [created] = await db.insert(services).values({
        organizationId: org.id,
        ...s,
      }).returning()
      serviceIds[s.name] = created.id
      console.log(`  Created service: ${s.name}`)
    }
  }

  // 7. Clients
  console.log('\nSeeding clients...')
  const clientSeed = [
    { firstName: 'Martín', lastName: 'García', whatsappRaw: '1155550001' },
    { firstName: 'Lucas', lastName: 'Pérez', whatsappRaw: '1155550002' },
    { firstName: 'Sebastián', lastName: 'López', whatsappRaw: '1155550003' },
    { firstName: 'Diego', lastName: 'Fernández', whatsappRaw: '1155550004' },
    { firstName: 'Gonzalo', lastName: 'Rodríguez', whatsappRaw: '1155550005' },
  ]

  const clientIds: string[] = []
  for (const c of clientSeed) {
    const e164 = normalizePhone(c.whatsappRaw)
    if (!e164) {
      console.log(`  Skipping client ${c.firstName} — invalid phone`)
      continue
    }

    const [existing] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.organizationId, org.id), eq(clients.whatsappE164, e164)))
      .limit(1)

    if (existing) {
      clientIds.push(existing.id)
      console.log(`  Client exists: ${c.firstName} ${c.lastName}`)
    } else {
      const [created] = await db.insert(clients).values({
        organizationId: org.id,
        firstName: c.firstName,
        lastName: c.lastName,
        whatsappRaw: c.whatsappRaw,
        whatsappE164: e164,
        consentData: true,
        consentDataAt: new Date(),
        consentWhatsapp: true,
        consentWhatsappAt: new Date(),
      }).returning()
      clientIds.push(created.id)
      console.log(`  Created client: ${c.firstName} ${c.lastName} (${e164})`)
    }
  }

  // 8. Barber schedules (Mon-Sat, 09:00-18:00)
  console.log('\nSeeding barber schedules...')
  if (barberoId && centroBranchId) {
    for (let weekday = 1; weekday <= 6; weekday++) {
      const [existing] = await db
        .select()
        .from(barberSchedules)
        .where(
          and(
            eq(barberSchedules.barberId, barberoId),
            eq(barberSchedules.branchId, centroBranchId),
            eq(barberSchedules.weekday, weekday),
          ),
        )
        .limit(1)

      if (!existing) {
        await db.insert(barberSchedules).values({
          organizationId: org.id,
          barberId: barberoId,
          branchId: centroBranchId,
          weekday,
          startTime: '09:00',
          endTime: '18:00',
        })
        console.log(`  Created schedule: weekday ${weekday}`)
      } else {
        console.log(`  Schedule exists: weekday ${weekday}`)
      }
    }
  }

  // 9. Demo appointments
  console.log('\nSeeding demo appointments...')
  if (!barberoId || !adminId || !centroBranchId || clientIds.length === 0) {
    console.log('  Skipping appointments — missing required IDs')
  } else {
    const [corteId] = [serviceIds['Corte']]
    const [corteBarbId] = [serviceIds['Corte + Barba']]
    const [barbId] = [serviceIds['Barba']]

    const apptSeed = [
      // Upcoming
      { clientId: clientIds[0], serviceId: corteId, startH: 10, daysOffset: 1, status: 'scheduled' as const },
      { clientId: clientIds[1], serviceId: corteBarbId, startH: 11, daysOffset: 1, status: 'confirmed' as const },
      { clientId: clientIds[2], serviceId: barbId, startH: 14, daysOffset: 2, status: 'scheduled' as const },
      // Today
      { clientId: clientIds[3], serviceId: corteId, startH: 9, daysOffset: 0, status: 'completed' as const },
      { clientId: clientIds[4], serviceId: corteBarbId, startH: 10, daysOffset: 0, status: 'in_progress' as const },
      // Past
      { clientId: clientIds[0], serviceId: corteId, startH: 15, daysOffset: -1, status: 'completed' as const },
      { clientId: clientIds[1], serviceId: barbId, startH: 16, daysOffset: -2, status: 'cancelled' as const },
      { clientId: clientIds[2], serviceId: corteId, startH: 11, daysOffset: -3, status: 'no_show' as const },
    ]

    for (const a of apptSeed) {
      if (!a.serviceId) continue

      const svc = await db.select().from(services).where(eq(services.id, a.serviceId)).limit(1)
      if (!svc[0]) continue

      const startAt = a.daysOffset >= 0 ? futureDate(a.daysOffset, a.startH) : pastDate(-a.daysOffset, a.startH)
      const endAt = new Date(startAt.getTime() + svc[0].durationMinutes * 60000)

      // Skip if an appointment already exists for this barber at this exact time
      const { sql: sqlHelper } = await import('drizzle-orm')
      const overlap = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.barberId, barberoId),
            sqlHelper`${appointments.startAt} = ${startAt}`,
          ),
        )
        .limit(1)

      if (overlap.length > 0) {
        console.log(`  Appointment already exists at ${startAt.toISOString()}`)
        continue
      }

      const [appt] = await db.insert(appointments).values({
        organizationId: org.id,
        branchId: centroBranchId,
        barberId: barberoId,
        clientId: a.clientId,
        createdByUserId: adminId,
        status: a.status,
        source: 'booked',
        startAt,
        endAt,
        cancelReason: a.status === 'cancelled' ? 'Cliente canceló' : null,
      }).returning()

      await db.insert(appointmentServices).values({
        appointmentId: appt.id,
        serviceId: a.serviceId,
        priceAtTime: svc[0].price,
        durationAtTime: svc[0].durationMinutes,
      })

      await db.insert(appointmentHistory).values({
        organizationId: org.id,
        appointmentId: appt.id,
        action: 'created',
        toStatus: a.status,
        userId: adminId,
      })

      console.log(`  Created appointment: ${a.status} @ ${startAt.toISOString()}`)
    }
  }

  console.log('\nSeed completed successfully.')
  await sql.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
