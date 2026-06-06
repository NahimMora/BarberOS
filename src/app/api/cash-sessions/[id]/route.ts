import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  auditLogs,
  cashMovements,
  cashSessions,
  domainEvents,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { canManageCash } from '@/lib/finance/authorization'
import { FinanceError } from '@/lib/finance/errors'
import {
  calculateCashSnapshot,
  formatCents,
  MoneyError,
  parseMoney,
} from '@/lib/money/money'

const closeSchema = z.object({
  action: z.literal('close'),
  countedCash: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = closeSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const countedCashCents = parseMoney(parsed.data.countedCash)
    if (countedCashCents < 0n) throw new FinanceError('El efectivo contado no puede ser negativo')

    const [current] = await db
      .select()
      .from(cashSessions)
      .where(and(
        eq(cashSessions.id, id),
        eq(cashSessions.organizationId, user.organizationId),
      ))
      .limit(1)
    if (!current) throw new FinanceError('Caja no encontrada', 404)
    if (!canManageCash(user, current.branchId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const closed = await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(cashSessions)
        .where(and(
          eq(cashSessions.id, id),
          eq(cashSessions.organizationId, user.organizationId),
        ))
        .limit(1)
        .for('update')
      if (!session) throw new FinanceError('Caja no encontrada', 404)
      if (session.status !== 'open') throw new FinanceError('La caja ya está cerrada', 409)

      const movements = await tx
        .select()
        .from(cashMovements)
        .where(and(
          eq(cashMovements.organizationId, user.organizationId),
          eq(cashMovements.cashSessionId, id),
        ))
      const snapshot = calculateCashSnapshot(
        session.openingAmount,
        movements.map((movement) => ({
          type: movement.type,
          method: movement.paymentMethod,
          amount: movement.amount,
        })),
      )
      const cashDifference = formatCents(
        countedCashCents - parseMoney(snapshot.expectedCash),
      )
      const closedAt = new Date()

      const [updated] = await tx
        .update(cashSessions)
        .set({
          closedBy: user.id,
          closedAt,
          expectedCash: snapshot.expectedCash,
          expectedTransfer: snapshot.expectedTransfer,
          expectedCard: snapshot.expectedCard,
          expectedMercadopagoManual: snapshot.expectedMercadopagoManual,
          expectedOther: snapshot.expectedOther,
          expectedTotal: snapshot.expectedTotal,
          countedCash: parsed.data.countedCash,
          cashDifference,
          status: 'closed',
          updatedAt: closedAt,
        })
        .where(eq(cashSessions.id, id))
        .returning()

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'cash.closed',
        entity: 'cash_sessions',
        entityId: id,
        diff: {
          branchId: session.branchId,
          openingAmount: session.openingAmount,
          ...snapshot,
          countedCash: parsed.data.countedCash,
          cashDifference,
        },
      })
      await tx.insert(domainEvents).values({
        organizationId: user.organizationId,
        eventType: 'cash.closed',
        payload: {
          cashSessionId: id,
          branchId: session.branchId,
          expectedCash: snapshot.expectedCash,
          countedCash: parsed.data.countedCash,
          cashDifference,
        },
        occurredAt: closedAt,
      })

      return updated
    })

    return NextResponse.json(closed)
  } catch (error) {
    if (error instanceof FinanceError || error instanceof MoneyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof FinanceError ? error.status : 400 },
      )
    }
    throw error
  }
}
