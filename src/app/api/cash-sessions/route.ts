import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  auditLogs,
  branches,
  cashMovements,
  cashSessions,
  domainEvents,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { canManageCash } from '@/lib/finance/authorization'
import { calculateCashSnapshot, MoneyError, parseMoney } from '@/lib/money/money'

const openSchema = z.object({
  branchId: z.string().uuid(),
  openingAmount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
})

export async function GET(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const branchId = new URL(req.url).searchParams.get('branch_id')
  if (!branchId) {
    return NextResponse.json({ error: 'branch_id es requerido' }, { status: 400 })
  }
  if (!canManageCash(user, branchId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sessions = await db
    .select()
    .from(cashSessions)
    .where(and(
      eq(cashSessions.organizationId, user.organizationId),
      eq(cashSessions.branchId, branchId),
    ))
    .orderBy(desc(cashSessions.openedAt))
    .limit(20)

  const openSession = sessions.find((session) => session.status === 'open') ?? null
  let liveSnapshot = null
  let movements: typeof cashMovements.$inferSelect[] = []

  if (openSession) {
    movements = await db
      .select()
      .from(cashMovements)
      .where(and(
        eq(cashMovements.organizationId, user.organizationId),
        eq(cashMovements.cashSessionId, openSession.id),
      ))
      .orderBy(desc(cashMovements.createdAt))

    liveSnapshot = calculateCashSnapshot(
      openSession.openingAmount,
      movements.map((movement) => ({
        type: movement.type,
        method: movement.paymentMethod,
        amount: movement.amount,
      })),
    )
  }

  return NextResponse.json({
    openSession,
    liveSnapshot,
    movements,
    recentSessions: sessions.filter((session) => session.status !== 'open'),
  })
}

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = openSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { branchId, openingAmount } = parsed.data
  if (!canManageCash(user, branchId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (parseMoney(openingAmount) < 0n) {
      return NextResponse.json({ error: 'La apertura no puede ser negativa' }, { status: 400 })
    }

    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(
        eq(branches.id, branchId),
        eq(branches.organizationId, user.organizationId),
        eq(branches.active, true),
        isNull(branches.deletedAt),
      ))
      .limit(1)
    if (!branch) return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })

    const cashSession = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(cashSessions)
        .values({
          organizationId: user.organizationId,
          branchId,
          openingAmount,
          openedBy: user.id,
        })
        .returning()

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'cash.opened',
        entity: 'cash_sessions',
        entityId: created.id,
        diff: { branchId, openingAmount },
      })
      await tx.insert(domainEvents).values({
        organizationId: user.organizationId,
        eventType: 'cash.opened',
        payload: { cashSessionId: created.id, branchId, openingAmount },
        occurredAt: created.openedAt,
      })
      return created
    })

    return NextResponse.json(cashSession, { status: 201 })
  } catch (error) {
    if (error instanceof MoneyError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const pgError = error as { code?: string }
    if (pgError.code === '23505') {
      return NextResponse.json(
        { error: 'La sucursal ya tiene una caja abierta' },
        { status: 409 },
      )
    }
    throw error
  }
}
