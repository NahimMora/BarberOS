import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  auditLogs,
  commissions,
  domainEvents,
  sales,
  users,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { canViewCommissions } from '@/lib/finance/authorization'
import { formatCents, parseMoney } from '@/lib/money/money'

const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

const settleSchema = z.object({
  action: z.literal('settle'),
  barberId: z.string().uuid(),
  period: periodSchema,
})

export async function GET(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'receptionist') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const searchParams = new URL(req.url).searchParams
  const parsedPeriod = periodSchema.safeParse(searchParams.get('period'))
  if (!parsedPeriod.success) {
    return NextResponse.json({ error: 'period debe tener formato YYYY-MM' }, { status: 400 })
  }

  const requestedBarberId = searchParams.get('barber_id')
  const barberId = user.role === 'barber' ? user.id : requestedBarberId
  if (barberId && !canViewCommissions(user, barberId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const conditions = [
    eq(commissions.organizationId, user.organizationId),
    eq(commissions.period, parsedPeriod.data),
  ]
  if (barberId) conditions.push(eq(commissions.barberId, barberId))

  const rows = await db
    .select({
      id: commissions.id,
      barberId: commissions.barberId,
      barberName: users.fullName,
      saleId: commissions.saleId,
      branchId: sales.branchId,
      baseAmount: commissions.baseAmount,
      rateSnapshot: commissions.rateSnapshot,
      commissionAmount: commissions.commissionAmount,
      period: commissions.period,
      status: commissions.status,
      paidAt: sales.paidAt,
    })
    .from(commissions)
    .innerJoin(users, eq(users.id, commissions.barberId))
    .innerJoin(sales, eq(sales.id, commissions.saleId))
    .where(and(...conditions))
    .orderBy(asc(users.fullName), asc(sales.paidAt))

  const grouped = new Map<string, {
    barberId: string
    barberName: string
    salesCount: number
    baseAmount: bigint
    commissionAmount: bigint
    pendingAmount: bigint
    paidAmount: bigint
  }>()

  for (const row of rows) {
    const current = grouped.get(row.barberId) ?? {
      barberId: row.barberId,
      barberName: row.barberName,
      salesCount: 0,
      baseAmount: 0n,
      commissionAmount: 0n,
      pendingAmount: 0n,
      paidAmount: 0n,
    }
    const amount = parseMoney(row.commissionAmount)
    current.salesCount += 1
    current.baseAmount += parseMoney(row.baseAmount)
    current.commissionAmount += amount
    if (row.status === 'pending') current.pendingAmount += amount
    if (row.status === 'paid') current.paidAmount += amount
    grouped.set(row.barberId, current)
  }

  return NextResponse.json({
    period: parsedPeriod.data,
    summary: [...grouped.values()].map((entry) => ({
      barberId: entry.barberId,
      barberName: entry.barberName,
      salesCount: entry.salesCount,
      baseAmount: formatCents(entry.baseAmount),
      commissionAmount: formatCents(entry.commissionAmount),
      pendingAmount: formatCents(entry.pendingAmount),
      paidAmount: formatCents(entry.paidAmount),
    })),
    entries: rows,
  })
}

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = settleSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { barberId, period } = parsed.data
  const [barber] = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(
      eq(users.id, barberId),
      eq(users.organizationId, user.organizationId),
      eq(users.role, 'barber'),
    ))
    .limit(1)
  if (!barber) return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })

  const result = await db.transaction(async (tx) => {
    const pendingRows = await tx
      .select({
        id: commissions.id,
        commissionAmount: commissions.commissionAmount,
      })
      .from(commissions)
      .where(and(
        eq(commissions.organizationId, user.organizationId),
        eq(commissions.barberId, barberId),
        eq(commissions.period, period),
        eq(commissions.status, 'pending'),
      ))
      .for('update')

    if (pendingRows.length === 0) {
      return { updatedCount: 0, amount: '0.00' }
    }

    const amount = pendingRows.reduce(
      (total, row) => total + parseMoney(row.commissionAmount),
      0n,
    )
    await tx
      .update(commissions)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(inArray(commissions.id, pendingRows.map((row) => row.id)))

    await tx.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'commission.settled',
      entity: 'users',
      entityId: barberId,
      diff: {
        period,
        commissionIds: pendingRows.map((row) => row.id),
        updatedCount: pendingRows.length,
        amount: formatCents(amount),
      },
    })
    await tx.insert(domainEvents).values({
      organizationId: user.organizationId,
      eventType: 'commission.settled',
      payload: {
        barberId,
        period,
        updatedCount: pendingRows.length,
        amount: formatCents(amount),
      },
      occurredAt: new Date(),
    })

    return { updatedCount: pendingRows.length, amount: formatCents(amount) }
  })

  return NextResponse.json({ ...result, barberId, barberName: barber.fullName, period })
}
