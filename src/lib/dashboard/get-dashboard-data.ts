import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  sql,
} from 'drizzle-orm'
import {
  appointments,
  branches,
  cashSessions,
  clients,
  commissions,
  organizationSettings,
  sales,
  users,
} from '@/db/schema'
import type { AppUser } from '@/lib/auth/get-session'
import {
  getLocalCalendarDate,
  getLocalCalendarMonth,
  getLocalDayUtcRange,
  getLocalMonthUtcRange,
} from '@/lib/datetime/local-day-range'
import { db } from '@/lib/db'

export type DashboardAgendaItem = {
  id: string
  branchName: string
  barberName: string
  clientName: string
  status: typeof appointments.$inferSelect.status
  startAt: Date
  endAt: Date
}

export type DashboardBranch = {
  id: string
  name: string
  todayRevenue: string
  monthRevenue: string
  todaySales: number
  todayAppointments: number
  cashStatus: 'open' | 'closed'
  cashOpenedAt: Date | null
}

export type DashboardData = {
  role: AppUser['role']
  timeZone: string
  calendarDate: string
  calendarMonth: string
  summary: {
    todayRevenue: string
    monthRevenue: string
    todaySales: number
    todayAppointments: number
    openCashSessions: number
    pendingCommissions: string | null
  }
  barberMetrics: {
    completedCuts: number
    generatedRevenue: string
    accruedCommission: string
  } | null
  branches: DashboardBranch[]
  agenda: DashboardAgendaItem[]
}

export async function getDashboardData(
  user: AppUser,
  now = new Date(),
): Promise<DashboardData> {
  const [settings] = await db
    .select({ defaultTimezone: organizationSettings.defaultTimezone })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, user.organizationId))
    .limit(1)

  const timeZone = settings?.defaultTimezone ?? 'America/Argentina/Buenos_Aires'
  const calendarDate = getLocalCalendarDate(now, timeZone)
  const calendarMonth = getLocalCalendarMonth(now, timeZone)
  const dayRange = getLocalDayUtcRange(calendarDate, timeZone)
  const monthRange = getLocalMonthUtcRange(calendarMonth, timeZone)

  const branchConditions = [
    eq(branches.organizationId, user.organizationId),
    eq(branches.active, true),
    isNull(branches.deletedAt),
  ]
  if (user.role !== 'admin') {
    if (user.branchIds.length === 0) {
      return emptyDashboard(user.role, timeZone, calendarDate, calendarMonth)
    }
    branchConditions.push(inArray(branches.id, user.branchIds))
  }

  const branchRows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(...branchConditions))
    .orderBy(asc(branches.name))

  if (user.role === 'barber') {
    return getBarberDashboard(
      user,
      branchRows,
      timeZone,
      calendarDate,
      calendarMonth,
      dayRange,
      monthRange,
    )
  }

  if (branchRows.length === 0) {
    return emptyDashboard(user.role, timeZone, calendarDate, calendarMonth)
  }

  const branchIds = branchRows.map((branch) => branch.id)
  const [saleRows, appointmentRows, openCashRows, agendaRows, pendingRows] = await Promise.all([
    db
      .select({
        branchId: sales.branchId,
        todayRevenue: sql<string>`
          coalesce(
            sum(${sales.total}) filter (
              where ${sales.paidAt} >= ${dayRange.start.toISOString()}::timestamptz
                and ${sales.paidAt} < ${dayRange.end.toISOString()}::timestamptz
            ),
            0
          )::text
        `,
        monthRevenue: sql<string>`coalesce(sum(${sales.total}), 0)::text`,
        todaySales: sql<number>`
          (
            count(*) filter (
              where ${sales.paidAt} >= ${dayRange.start.toISOString()}::timestamptz
                and ${sales.paidAt} < ${dayRange.end.toISOString()}::timestamptz
            )
          )::int
        `,
      })
      .from(sales)
      .where(and(
        eq(sales.organizationId, user.organizationId),
        eq(sales.status, 'paid'),
        inArray(sales.branchId, branchIds),
        gte(sales.paidAt, monthRange.start),
        lt(sales.paidAt, monthRange.end),
      ))
      .groupBy(sales.branchId),
    db
      .select({
        branchId: appointments.branchId,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(and(
        eq(appointments.organizationId, user.organizationId),
        inArray(appointments.branchId, branchIds),
        ne(appointments.status, 'cancelled'),
        gte(appointments.startAt, dayRange.start),
        lt(appointments.startAt, dayRange.end),
      ))
      .groupBy(appointments.branchId),
    db
      .select({
        branchId: cashSessions.branchId,
        openedAt: cashSessions.openedAt,
      })
      .from(cashSessions)
      .where(and(
        eq(cashSessions.organizationId, user.organizationId),
        inArray(cashSessions.branchId, branchIds),
        eq(cashSessions.status, 'open'),
      )),
    getAgendaRows(user.organizationId, branchIds, dayRange),
    user.role === 'admin'
      ? db
        .select({
          amount: sql<string>`coalesce(sum(${commissions.commissionAmount}), 0)::text`,
        })
        .from(commissions)
        .where(and(
          eq(commissions.organizationId, user.organizationId),
          eq(commissions.period, calendarMonth),
          eq(commissions.status, 'pending'),
        ))
      : Promise.resolve([{ amount: '0.00' }]),
  ])

  const salesByBranch = new Map(saleRows.map((row) => [row.branchId, row]))
  const appointmentsByBranch = new Map(
    appointmentRows.map((row) => [row.branchId, row.count]),
  )
  const cashByBranch = new Map(
    openCashRows.map((row) => [row.branchId, row.openedAt]),
  )
  const branchData = branchRows.map((branch) => {
    const branchSales = salesByBranch.get(branch.id)
    const cashOpenedAt = cashByBranch.get(branch.id) ?? null
    return {
      ...branch,
      todayRevenue: branchSales?.todayRevenue ?? '0.00',
      monthRevenue: branchSales?.monthRevenue ?? '0.00',
      todaySales: branchSales?.todaySales ?? 0,
      todayAppointments: appointmentsByBranch.get(branch.id) ?? 0,
      cashStatus: cashOpenedAt ? 'open' as const : 'closed' as const,
      cashOpenedAt,
    }
  })

  return {
    role: user.role,
    timeZone,
    calendarDate,
    calendarMonth,
    summary: {
      todayRevenue: sumMoney(branchData.map((branch) => branch.todayRevenue)),
      monthRevenue: sumMoney(branchData.map((branch) => branch.monthRevenue)),
      todaySales: branchData.reduce((total, branch) => total + branch.todaySales, 0),
      todayAppointments: branchData.reduce(
        (total, branch) => total + branch.todayAppointments,
        0,
      ),
      openCashSessions: openCashRows.length,
      pendingCommissions: user.role === 'admin'
        ? pendingRows[0]?.amount ?? '0.00'
        : null,
    },
    barberMetrics: null,
    branches: branchData,
    agenda: agendaRows,
  }
}

async function getBarberDashboard(
  user: AppUser,
  branchRows: Array<{ id: string; name: string }>,
  timeZone: string,
  calendarDate: string,
  calendarMonth: string,
  dayRange: { start: Date; end: Date },
  monthRange: { start: Date; end: Date },
): Promise<DashboardData> {
  const branchIds = branchRows.map((branch) => branch.id)
  const [agendaRows, completedRows, revenueRows, commissionRows] = await Promise.all([
    getAgendaRows(user.organizationId, branchIds, dayRange, user.id),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(
        eq(appointments.organizationId, user.organizationId),
        eq(appointments.barberId, user.id),
        eq(appointments.status, 'completed'),
        gte(appointments.startAt, monthRange.start),
        lt(appointments.startAt, monthRange.end),
      )),
    db
      .select({ amount: sql<string>`coalesce(sum(${sales.total}), 0)::text` })
      .from(sales)
      .where(and(
        eq(sales.organizationId, user.organizationId),
        eq(sales.barberId, user.id),
        eq(sales.status, 'paid'),
        gte(sales.paidAt, monthRange.start),
        lt(sales.paidAt, monthRange.end),
      )),
    db
      .select({
        amount: sql<string>`coalesce(sum(${commissions.commissionAmount}), 0)::text`,
      })
      .from(commissions)
      .where(and(
        eq(commissions.organizationId, user.organizationId),
        eq(commissions.barberId, user.id),
        eq(commissions.period, calendarMonth),
        ne(commissions.status, 'cancelled'),
      )),
  ])

  return {
    role: user.role,
    timeZone,
    calendarDate,
    calendarMonth,
    summary: {
      todayRevenue: '0.00',
      monthRevenue: revenueRows[0]?.amount ?? '0.00',
      todaySales: 0,
      todayAppointments: agendaRows.length,
      openCashSessions: 0,
      pendingCommissions: null,
    },
    barberMetrics: {
      completedCuts: completedRows[0]?.count ?? 0,
      generatedRevenue: revenueRows[0]?.amount ?? '0.00',
      accruedCommission: commissionRows[0]?.amount ?? '0.00',
    },
    branches: branchRows.map((branch) => ({
      ...branch,
      todayRevenue: '0.00',
      monthRevenue: '0.00',
      todaySales: 0,
      todayAppointments: agendaRows.filter((item) => item.branchName === branch.name).length,
      cashStatus: 'closed',
      cashOpenedAt: null,
    })),
    agenda: agendaRows,
  }
}

async function getAgendaRows(
  organizationId: string,
  branchIds: string[],
  dayRange: { start: Date; end: Date },
  barberId?: string,
): Promise<DashboardAgendaItem[]> {
  if (branchIds.length === 0) return []

  const conditions = [
    eq(appointments.organizationId, organizationId),
    inArray(appointments.branchId, branchIds),
    ne(appointments.status, 'cancelled'),
    gte(appointments.startAt, dayRange.start),
    lt(appointments.startAt, dayRange.end),
  ]
  if (barberId) conditions.push(eq(appointments.barberId, barberId))

  const rows = await db
    .select({
      id: appointments.id,
      branchName: branches.name,
      barberName: users.fullName,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
    })
    .from(appointments)
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .innerJoin(users, eq(users.id, appointments.barberId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(...conditions))
    .orderBy(asc(appointments.startAt))
    .limit(60)

  return rows.map((row) => ({
    id: row.id,
    branchName: row.branchName,
    barberName: row.barberName,
    clientName: [row.clientFirstName, row.clientLastName].filter(Boolean).join(' ')
      || 'Sin cliente',
    status: row.status,
    startAt: row.startAt,
    endAt: row.endAt,
  }))
}

function emptyDashboard(
  role: AppUser['role'],
  timeZone: string,
  calendarDate: string,
  calendarMonth: string,
): DashboardData {
  return {
    role,
    timeZone,
    calendarDate,
    calendarMonth,
    summary: {
      todayRevenue: '0.00',
      monthRevenue: '0.00',
      todaySales: 0,
      todayAppointments: 0,
      openCashSessions: 0,
      pendingCommissions: role === 'admin' ? '0.00' : null,
    },
    barberMetrics: role === 'barber'
      ? { completedCuts: 0, generatedRevenue: '0.00', accruedCommission: '0.00' }
      : null,
    branches: [],
    agenda: [],
  }
}

function sumMoney(values: string[]): string {
  const cents = values.reduce((total, value) => {
    const [integer = '0', decimals = '00'] = value.split('.')
    return total + BigInt(integer) * 100n + BigInt(decimals.padEnd(2, '0').slice(0, 2))
  }, 0n)

  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}
