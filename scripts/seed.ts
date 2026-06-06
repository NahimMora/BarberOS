import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and, isNull } from 'drizzle-orm'
import {
  auditLogs,
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
  cashMovements,
  cashSessions,
  commissions,
  domainEvents,
  payments,
  saleItems,
  sales,
} from '../src/db/schema'
import { normalizePhone } from '../src/lib/phone/normalize'
import {
  calculateCashSnapshot,
  calculateCommission,
  calculateSaleTotals,
  formatCents,
  parseMoney,
  type PaymentMethod,
} from '../src/lib/money/money'
import { getCommissionPeriod } from '../src/lib/finance/commission-period'

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
  { email: 'recep.norte@demo.com', fullName: 'Recepcionista Norte', role: 'receptionist' as const },
  { email: 'barbero@demo.com', fullName: 'Barbero Demo', role: 'barber' as const },
  { email: 'barbero.norte@demo.com', fullName: 'Barbero Norte', role: 'barber' as const },
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
          displayColor: u.email.includes('norte') ? '#b45309' : '#6366f1',
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
      .where(and(eq(userBranches.userId, userId), eq(userBranches.branchId, branchId)))
      .limit(1)

    if (!existing) {
      await db.insert(userBranches).values({ organizationId: org.id, userId, branchId })
      console.log(`  Assigned ${email} → ${branchName}`)
    } else {
      console.log(`  Branch already assigned: ${email}`)
    }
  }

  await assignBranch('barbero@demo.com', 'Centro')
  await assignBranch('barbero.norte@demo.com', 'Norte')
  await assignBranch('recep@demo.com', 'Centro')
  await assignBranch('recep.norte@demo.com', 'Norte')

  // --- FASE 1 DATA ---

  const barberoId = userIds['barbero@demo.com']
  const barberoNorteId = userIds['barbero.norte@demo.com']
  const adminId = userIds['admin@demo.com']
  const centroBranchId = branchIds['Centro']
  const norteBranchId = branchIds['Norte']

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
    { firstName: 'Martín', lastName: 'García', whatsappRaw: '+5491123456789' },
    { firstName: 'Lucas', lastName: 'Pérez', whatsappRaw: '+5491123456790' },
    { firstName: 'Sebastián', lastName: 'López', whatsappRaw: '+5491123456791' },
    { firstName: 'Diego', lastName: 'Fernández', whatsappRaw: '+5491123456792' },
    { firstName: 'Gonzalo', lastName: 'Rodríguez', whatsappRaw: '+5491123456793' },
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
  const scheduleTargets = [
    { barberId: barberoId, branchId: centroBranchId },
    { barberId: barberoNorteId, branchId: norteBranchId },
  ].filter((target): target is { barberId: string; branchId: string } => Boolean(target.barberId && target.branchId))

  for (const target of scheduleTargets) {
    for (let weekday = 1; weekday <= 6; weekday++) {
      const [existing] = await db
        .select()
        .from(barberSchedules)
        .where(
          and(
            eq(barberSchedules.barberId, target.barberId),
            eq(barberSchedules.branchId, target.branchId),
            eq(barberSchedules.weekday, weekday),
          ),
        )
        .limit(1)

      if (!existing) {
        await db.insert(barberSchedules).values({
          organizationId: org.id,
          barberId: target.barberId,
          branchId: target.branchId,
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

    type SeedAppointment = {
      clientId: string
      serviceId: string
      startH: number
      daysOffset: number
      status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
      barberId?: string
      branchId?: string
    }

    const apptSeed: SeedAppointment[] = [
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
      { clientId: clientIds[2], serviceId: barbId, startH: 13, daysOffset: -4, status: 'completed' as const },
      ...(barberoNorteId && norteBranchId
        ? [
            { clientId: clientIds[3], serviceId: corteId, startH: 12, daysOffset: 1, status: 'scheduled' as const, barberId: barberoNorteId, branchId: norteBranchId },
            { clientId: clientIds[4], serviceId: barbId, startH: 15, daysOffset: 2, status: 'confirmed' as const, barberId: barberoNorteId, branchId: norteBranchId },
            { clientId: clientIds[3], serviceId: corteBarbId, startH: 12, daysOffset: -1, status: 'completed' as const, barberId: barberoNorteId, branchId: norteBranchId },
            { clientId: clientIds[4], serviceId: corteId, startH: 14, daysOffset: -2, status: 'completed' as const, barberId: barberoNorteId, branchId: norteBranchId },
          ]
        : []),
    ]

    for (const a of apptSeed) {
      if (!a.serviceId) continue

      const svc = await db.select().from(services).where(eq(services.id, a.serviceId)).limit(1)
      if (!svc[0]) continue

      const startAt = a.daysOffset >= 0 ? futureDate(a.daysOffset, a.startH) : pastDate(-a.daysOffset, a.startH)
      const endAt = new Date(startAt.getTime() + svc[0].durationMinutes * 60000)
      const appointmentBarberId = a.barberId ?? barberoId
      const appointmentBranchId = a.branchId ?? centroBranchId

      // Skip if an appointment already exists for this barber at this exact time
      const overlap = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.barberId, appointmentBarberId),
            eq(appointments.startAt, startAt),
          ),
        )
        .limit(1)

      if (overlap.length > 0) {
        console.log(`  Appointment already exists at ${startAt.toISOString()}`)
        continue
      }

      const [appt] = await db.insert(appointments).values({
        organizationId: org.id,
        branchId: appointmentBranchId,
        barberId: appointmentBarberId,
        clientId: a.clientId,
        createdByUserId: adminId,
        status: a.status,
        source: 'booked',
        startAt,
        endAt,
        cancelReason: a.status === 'cancelled' ? 'Cliente canceló' : null,
      }).returning()

      await db.insert(appointmentServices).values({
        organizationId: org.id,
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

  // --- FASE 2 DATA ---

  console.log('\nSeeding financial demo data...')
  const [settings] = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, org.id))
    .limit(1)
  const completedWithoutSale = await db
    .select({
      id: appointments.id,
      branchId: appointments.branchId,
      barberId: appointments.barberId,
      clientId: appointments.clientId,
      startAt: appointments.startAt,
    })
    .from(appointments)
    .leftJoin(sales, eq(sales.appointmentId, appointments.id))
    .where(and(
      eq(appointments.organizationId, org.id),
      eq(appointments.status, 'completed'),
      isNull(sales.id),
    ))

  const [existingSale] = await db
    .select({ id: sales.id })
    .from(sales)
    .where(eq(sales.organizationId, org.id))
    .limit(1)
  const firstFinancialSeed = !existingSale
  const sessionByBranch = new Map<string, string>()
  const sessionsCreatedForClosing = new Set<string>()

  for (const appointment of completedWithoutSale) {
    let cashSessionId = sessionByBranch.get(appointment.branchId)
    if (!cashSessionId) {
      const [openSession] = await db
        .select({ id: cashSessions.id })
        .from(cashSessions)
        .where(and(
          eq(cashSessions.organizationId, org.id),
          eq(cashSessions.branchId, appointment.branchId),
          eq(cashSessions.status, 'open'),
        ))
        .limit(1)

      if (openSession) {
        cashSessionId = openSession.id
      } else {
        const [createdSession] = await db
          .insert(cashSessions)
          .values({
            organizationId: org.id,
            branchId: appointment.branchId,
            openedBy: adminId,
            openedAt: firstFinancialSeed ? pastDate(1, 8) : new Date(),
            openingAmount: '10000.00',
          })
          .returning({ id: cashSessions.id })
        cashSessionId = createdSession.id
        if (firstFinancialSeed) sessionsCreatedForClosing.add(createdSession.id)
        console.log(`  Created cash session for branch ${appointment.branchId}`)
      }
      sessionByBranch.set(appointment.branchId, cashSessionId)
    }

    const appointmentItemRows = await db
      .select({
        serviceId: appointmentServices.serviceId,
        description: services.name,
        unitPrice: appointmentServices.priceAtTime,
      })
      .from(appointmentServices)
      .innerJoin(services, eq(services.id, appointmentServices.serviceId))
      .where(eq(appointmentServices.appointmentId, appointment.id))
    if (appointmentItemRows.length === 0) continue

    const discount = completedWithoutSale.indexOf(appointment) === 0 ? '500.00' : '0.00'
    const totals = calculateSaleTotals(
      appointmentItemRows.map((item) => ({ quantity: 1, unitPrice: item.unitPrice })),
      discount,
    )
    const paymentMethod: PaymentMethod = (
      ['cash', 'transfer', 'card', 'mercadopago_manual', 'other'] as const
    )[completedWithoutSale.indexOf(appointment) % 5]
    const [profile] = await db
      .select({ commissionRate: barberProfiles.commissionRate })
      .from(barberProfiles)
      .where(and(
        eq(barberProfiles.organizationId, org.id),
        eq(barberProfiles.userId, appointment.barberId),
      ))
      .limit(1)
    const rateSnapshot = profile?.commissionRate
      ?? settings?.defaultCommissionRate
      ?? '0.00'
    const paidAt = appointment.startAt
    const commissionAmount = calculateCommission(totals.total, rateSnapshot)

    await db.transaction(async (tx) => {
      const [sale] = await tx
        .insert(sales)
        .values({
          organizationId: org.id,
          branchId: appointment.branchId,
          appointmentId: appointment.id,
          barberId: appointment.barberId,
          clientId: appointment.clientId,
          subtotal: totals.subtotal,
          discount: totals.discount,
          total: totals.total,
          status: 'paid',
          createdBy: adminId,
          paidAt,
        })
        .returning()

      await tx.insert(saleItems).values(appointmentItemRows.map((item) => ({
        organizationId: org.id,
        saleId: sale.id,
        serviceId: item.serviceId,
        description: item.description,
        quantity: 1,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice,
      })))
      await tx.insert(payments).values({
        organizationId: org.id,
        saleId: sale.id,
        method: paymentMethod,
        amount: totals.total,
        note: 'Pago demo',
        createdBy: adminId,
        createdAt: paidAt,
      })
      await tx.insert(cashMovements).values({
        organizationId: org.id,
        cashSessionId,
        type: 'sale',
        amount: totals.total,
        paymentMethod,
        referenceSaleId: sale.id,
        note: 'Cobro demo de turno',
        createdBy: adminId,
        createdAt: paidAt,
      })
      await tx.insert(commissions).values({
        organizationId: org.id,
        barberId: appointment.barberId,
        saleId: sale.id,
        baseAmount: totals.total,
        rateSnapshot,
        commissionAmount,
        period: getCommissionPeriod(
          paidAt,
          settings?.defaultTimezone ?? 'America/Argentina/Buenos_Aires',
        ),
      })
      await tx.insert(auditLogs).values({
        organizationId: org.id,
        userId: adminId,
        action: 'sale.paid',
        entity: 'sales',
        entityId: sale.id,
        diff: {
          source: 'seed',
          appointmentId: appointment.id,
          total: totals.total,
          paymentMethod,
          commissionAmount,
        },
        createdAt: paidAt,
      })
      await tx.insert(domainEvents).values({
        organizationId: org.id,
        eventType: 'sale.paid',
        payload: {
          source: 'seed',
          saleId: sale.id,
          branchId: appointment.branchId,
          total: totals.total,
          paymentMethod,
        },
        occurredAt: paidAt,
      })
    })
    console.log(`  Created paid sale for appointment ${appointment.id} (${paymentMethod})`)
  }

  if (firstFinancialSeed) {
    for (const sessionId of sessionsCreatedForClosing) {
      const [session] = await db
        .select()
        .from(cashSessions)
        .where(eq(cashSessions.id, sessionId))
        .limit(1)
      const movementRows = await db
        .select()
        .from(cashMovements)
        .where(eq(cashMovements.cashSessionId, sessionId))
      const snapshot = calculateCashSnapshot(
        session.openingAmount,
        movementRows.map((movement) => ({
          type: movement.type,
          method: movement.paymentMethod,
          amount: movement.amount,
        })),
      )
      const variance = session.branchId === centroBranchId ? 50000n : 0n
      const countedCash = formatCents(parseMoney(snapshot.expectedCash) - variance)
      const cashDifference = formatCents(
        parseMoney(countedCash) - parseMoney(snapshot.expectedCash),
      )
      const closedAt = pastDate(1, 19)

      await db.transaction(async (tx) => {
        await tx
          .update(cashSessions)
          .set({
            closedBy: adminId,
            closedAt,
            expectedCash: snapshot.expectedCash,
            expectedTransfer: snapshot.expectedTransfer,
            expectedCard: snapshot.expectedCard,
            expectedMercadopagoManual: snapshot.expectedMercadopagoManual,
            expectedOther: snapshot.expectedOther,
            expectedTotal: snapshot.expectedTotal,
            countedCash,
            cashDifference,
            status: 'closed',
            updatedAt: closedAt,
          })
          .where(eq(cashSessions.id, sessionId))
        await tx.insert(auditLogs).values({
          organizationId: org.id,
          userId: adminId,
          action: 'cash.closed',
          entity: 'cash_sessions',
          entityId: sessionId,
          diff: { source: 'seed', ...snapshot, countedCash, cashDifference },
          createdAt: closedAt,
        })
        await tx.insert(domainEvents).values({
          organizationId: org.id,
          eventType: 'cash.closed',
          payload: { source: 'seed', cashSessionId: sessionId, cashDifference },
          occurredAt: closedAt,
        })
      })
      console.log(`  Closed demo cash session ${sessionId} with difference ${cashDifference}`)
    }
  }

  const [openCentroSession] = await db
    .select()
    .from(cashSessions)
    .where(and(
      eq(cashSessions.organizationId, org.id),
      eq(cashSessions.branchId, centroBranchId),
      eq(cashSessions.status, 'open'),
    ))
    .limit(1)
  let currentCentroSession = openCentroSession
  if (!currentCentroSession) {
    ;[currentCentroSession] = await db
      .insert(cashSessions)
      .values({
        organizationId: org.id,
        branchId: centroBranchId,
        openedBy: adminId,
        openingAmount: '15000.00',
      })
      .returning()
    console.log('  Created current open cash session for Centro')
  }

  const [existingDemoExpense] = await db
    .select({ id: cashMovements.id })
    .from(cashMovements)
    .where(and(
      eq(cashMovements.cashSessionId, currentCentroSession.id),
      eq(cashMovements.note, 'Seed: insumos de limpieza'),
    ))
    .limit(1)
  if (!existingDemoExpense) {
    await db.insert(cashMovements).values({
      organizationId: org.id,
      cashSessionId: currentCentroSession.id,
      type: 'expense',
      amount: '1200.00',
      paymentMethod: 'cash',
      note: 'Seed: insumos de limpieza',
      createdBy: adminId,
    })
    console.log('  Created demo cash expense')
  }

  console.log('\nSeed completed successfully.')
  await sql.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
