import { and, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import {
  appointments,
  saleItems,
  sales,
  services,
  users,
} from '@/db/schema'
import { db } from '@/lib/db'
import { computeMonthRunRate, computeVariancePercent } from '@/lib/dashboard/projections'
import { getLocalCalendarDate, getLocalMonthUtcRange } from '@/lib/datetime/local-day-range'

export type DashboardStats = {
  revenueTrend: Array<{ date: string; revenue: string }>
  appointmentsByWeekday: Array<{ weekday: number; average: number }>
  monthProjection: { projected: string; varianceVsPreviousMonth: number | null }
  noShowRate: number
  topBarbers: Array<{ id: string; name: string; revenue: string; completedCuts: number }>
  topServices: Array<{ id: string; name: string; count: number; revenue: string }>
}

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  revenueTrend: [],
  appointmentsByWeekday: [],
  monthProjection: { projected: '0.00', varianceVsPreviousMonth: null },
  noShowRate: 0,
  topBarbers: [],
  topServices: [],
}

export async function getDashboardStats(params: {
  organizationId: string
  branchIds: string[]
  timeZone: string
  calendarDate: string
  calendarMonth: string
  monthRange: { start: Date; end: Date }
  now: Date
  barberId?: string
  includeRankings: boolean
}): Promise<DashboardStats> {
  const {
    organizationId, branchIds, timeZone, calendarDate, calendarMonth, monthRange, now, barberId, includeRankings,
  } = params
  if (branchIds.length === 0) return EMPTY_DASHBOARD_STATS

  const trendStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const occupancyStart = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000)
  const daysElapsed = Number(calendarDate.split('-')[2])
  const daysInMonth = Math.round((monthRange.end.getTime() - monthRange.start.getTime()) / 86_400_000)

  const saleConditions = [
    eq(sales.organizationId, organizationId),
    eq(sales.status, 'paid'),
    inArray(sales.branchId, branchIds),
  ]
  const appointmentConditions = [
    eq(appointments.organizationId, organizationId),
    inArray(appointments.branchId, branchIds),
  ]
  if (barberId) {
    saleConditions.push(eq(sales.barberId, barberId))
    appointmentConditions.push(eq(appointments.barberId, barberId))
  }

  const [
    trendSaleRows,
    occupancyAppointmentRows,
    monthRevenueRows,
    previousMonthRevenueRows,
    noShowRows,
    topBarberRevenueRows,
    topBarberCutRows,
    topServiceRows,
  ] = await Promise.all([
    // Traído crudo y agregado en JS por fecha local: Postgres no acepta un
    // GROUP BY sobre "(col AT TIME ZONE $n)" si el SELECT usa otro
    // parámetro distinto para el mismo AT TIME ZONE (cada interpolación
    // de `timeZone` es un bind param nuevo, aunque el valor sea igual).
    db
      .select({ paidAt: sales.paidAt, total: sales.total })
      .from(sales)
      .where(and(...saleConditions, gte(sales.paidAt, trendStart), lt(sales.paidAt, now))),
    db
      .select({ startAt: appointments.startAt })
      .from(appointments)
      .where(and(
        ...appointmentConditions,
        ne(appointments.status, 'cancelled'),
        gte(appointments.startAt, occupancyStart),
        lt(appointments.startAt, now),
      )),
    db
      .select({ revenue: sql<string>`coalesce(sum(${sales.total}), 0)::text` })
      .from(sales)
      .where(and(...saleConditions, gte(sales.paidAt, monthRange.start), lt(sales.paidAt, monthRange.end))),
    db
      .select({ revenue: sql<string>`coalesce(sum(${sales.total}), 0)::text` })
      .from(sales)
      .where(and(
        ...saleConditions,
        gte(sales.paidAt, previousMonthRange(calendarMonth, timeZone).start),
        lt(sales.paidAt, previousMonthRange(calendarMonth, timeZone).end),
      )),
    db
      .select({
        noShow: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')::int`,
        completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
      })
      .from(appointments)
      .where(and(
        ...appointmentConditions,
        inArray(appointments.status, ['completed', 'no_show']),
        gte(appointments.startAt, trendStart),
        lt(appointments.startAt, now),
      )),
    includeRankings
      ? db
        .select({
          barberId: sales.barberId,
          revenue: sql<string>`sum(${sales.total})::text`,
        })
        .from(sales)
        .where(and(...saleConditions, gte(sales.paidAt, monthRange.start), lt(sales.paidAt, monthRange.end)))
        .groupBy(sales.barberId)
        .orderBy(desc(sql`sum(${sales.total})`))
        .limit(5)
      : Promise.resolve([]),
    includeRankings
      ? db
        .select({
          barberId: appointments.barberId,
          count: sql<number>`count(*)::int`,
        })
        .from(appointments)
        .where(and(
          ...appointmentConditions,
          eq(appointments.status, 'completed'),
          gte(appointments.startAt, monthRange.start),
          lt(appointments.startAt, monthRange.end),
        ))
        .groupBy(appointments.barberId)
      : Promise.resolve([]),
    includeRankings
      ? db
        .select({
          serviceId: saleItems.serviceId,
          count: sql<number>`sum(${saleItems.quantity})::int`,
          revenue: sql<string>`sum(${saleItems.lineTotal})::text`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .where(and(...saleConditions, gte(sales.paidAt, monthRange.start), lt(sales.paidAt, monthRange.end)))
        .groupBy(saleItems.serviceId)
        .orderBy(desc(sql`sum(${saleItems.lineTotal})`))
        .limit(5)
      : Promise.resolve([]),
  ])

  const monthRevenue = monthRevenueRows[0]?.revenue ?? '0.00'
  const previousMonthRevenue = previousMonthRevenueRows[0]?.revenue ?? '0.00'
  const projected = computeMonthRunRate(monthRevenue, daysElapsed, daysInMonth)
  const noShow = noShowRows[0]?.noShow ?? 0
  const completed = noShowRows[0]?.completed ?? 0
  const noShowTotal = noShow + completed

  let topBarbers: DashboardStats['topBarbers'] = []
  if (includeRankings && topBarberRevenueRows.length > 0) {
    const barberIds = topBarberRevenueRows.map((row) => row.barberId)
    const barberRows = await db
      .select({ id: users.id, name: users.fullName })
      .from(users)
      .where(inArray(users.id, barberIds))
    const namesById = new Map(barberRows.map((row) => [row.id, row.name]))
    const cutsById = new Map(topBarberCutRows.map((row) => [row.barberId, row.count]))
    topBarbers = topBarberRevenueRows.map((row) => ({
      id: row.barberId,
      name: namesById.get(row.barberId) ?? 'Sin nombre',
      revenue: row.revenue,
      completedCuts: cutsById.get(row.barberId) ?? 0,
    }))
  }

  let topServices: DashboardStats['topServices'] = []
  if (includeRankings && topServiceRows.length > 0) {
    const serviceIds = topServiceRows.map((row) => row.serviceId)
    const serviceRows = await db
      .select({ id: services.id, name: services.name })
      .from(services)
      .where(inArray(services.id, serviceIds))
    const namesById = new Map(serviceRows.map((row) => [row.id, row.name]))
    topServices = topServiceRows.map((row) => ({
      id: row.serviceId,
      name: namesById.get(row.serviceId) ?? 'Servicio eliminado',
      count: row.count,
      revenue: row.revenue,
    }))
  }

  const revenueByDate = new Map<string, bigint>()
  for (const row of trendSaleRows) {
    if (!row.paidAt) continue
    const date = getLocalCalendarDate(row.paidAt, timeZone)
    revenueByDate.set(date, (revenueByDate.get(date) ?? 0n) + toCents(row.total))
  }
  const revenueTrend = [...revenueByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cents]) => ({ date, revenue: fromCents(cents) }))

  const countByWeekday = new Map<number, number>()
  for (const row of occupancyAppointmentRows) {
    const date = getLocalCalendarDate(row.startAt, timeZone)
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    countByWeekday.set(weekday, (countByWeekday.get(weekday) ?? 0) + 1)
  }
  const appointmentsByWeekday = [...countByWeekday.entries()]
    .map(([weekday, count]) => ({ weekday, average: count / 8 }))

  return {
    revenueTrend,
    appointmentsByWeekday,
    monthProjection: {
      projected,
      varianceVsPreviousMonth: computeVariancePercent(projected, previousMonthRevenue),
    },
    noShowRate: noShowTotal > 0 ? (noShow / noShowTotal) * 100 : 0,
    topBarbers,
    topServices,
  }
}

function toCents(value: string): bigint {
  const [integer = '0', decimals = '00'] = value.split('.')
  return BigInt(integer) * 100n + BigInt(decimals.padEnd(2, '0').slice(0, 2))
}

function fromCents(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}

function previousMonthRange(calendarMonth: string, timeZone: string): { start: Date; end: Date } {
  const [year, month] = calendarMonth.split('-').map(Number)
  const previousDate = new Date(Date.UTC(year, month - 2, 1))
  const previousMonth = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, '0')}`
  return getLocalMonthUtcRange(previousMonth, timeZone)
}
