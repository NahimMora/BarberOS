import { NextResponse } from 'next/server'
import { z } from 'zod'
import { zodErrorMessage } from '@/lib/validation/zod-error'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  auditLogs,
  cashMovements,
  cashSessions,
  commissions,
  domainEvents,
  sales,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'
import { FinanceError } from '@/lib/finance/errors'
import { formatCents, MoneyError, parseMoney } from '@/lib/money/money'
import { logger } from '@/lib/observability/logger'

const voidSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    requireRole(user, ['admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = voidSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }
  const { reason } = parsed.data

  try {
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx
        .select()
        .from(sales)
        .where(and(
          eq(sales.id, id),
          eq(sales.organizationId, user.organizationId),
        ))
        .limit(1)
        .for('update')
      if (!sale) throw new FinanceError('Venta no encontrada', 404)
      if (sale.status !== 'paid') {
        throw new FinanceError('Solo se pueden anular ventas pagas', 409)
      }

      const [commission] = await tx
        .select()
        .from(commissions)
        .where(and(
          eq(commissions.saleId, sale.id),
          eq(commissions.organizationId, user.organizationId),
        ))
        .limit(1)
        .for('update')
      if (commission?.status === 'paid') {
        throw new FinanceError(
          'No se puede anular: la comisión de esta venta ya fue liquidada',
          409,
        )
      }

      const originalMovements = await tx
        .select()
        .from(cashMovements)
        .where(and(
          eq(cashMovements.organizationId, user.organizationId),
          eq(cashMovements.type, 'sale'),
          eq(cashMovements.referenceSaleId, sale.id),
        ))

      const voidedAt = new Date()
      const voidMovements = await Promise.all(originalMovements.map((movement) => tx
        .insert(cashMovements)
        .values({
          organizationId: user.organizationId,
          cashSessionId: movement.cashSessionId,
          type: 'void',
          amount: formatCents(-parseMoney(movement.amount)),
          paymentMethod: movement.paymentMethod,
          referenceSaleId: sale.id,
          note: `Anulación de venta: ${reason}`,
          createdBy: user.id,
        })
        .returning()
        .then(([row]) => row)))

      const sessionIds = [...new Set(originalMovements.map((movement) => movement.cashSessionId))]
      const involvedSessions = sessionIds.length
        ? await tx
          .select({ id: cashSessions.id, status: cashSessions.status })
          .from(cashSessions)
          .where(and(
            eq(cashSessions.organizationId, user.organizationId),
            inArray(cashSessions.id, sessionIds),
          ))
        : []
      const closedSessionIds = involvedSessions
        .filter((session) => session.status !== 'open')
        .map((session) => session.id)

      const [updatedSale] = await tx
        .update(sales)
        .set({
          status: 'cancelled',
          voidedAt,
          voidedBy: user.id,
          voidReason: reason,
          updatedAt: voidedAt,
        })
        .where(eq(sales.id, sale.id))
        .returning()

      if (commission && commission.status === 'pending') {
        await tx
          .update(commissions)
          .set({ status: 'cancelled', updatedAt: voidedAt })
          .where(eq(commissions.id, commission.id))
      }

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'sale.voided',
        entity: 'sales',
        entityId: sale.id,
        diff: {
          reason,
          previousStatus: sale.status,
          total: sale.total,
          commissionId: commission?.id ?? null,
          commissionStatus: commission?.status ?? null,
          cashMovementsReversed: voidMovements.map((movement) => ({
            id: movement.id,
            paymentMethod: movement.paymentMethod,
            amount: movement.amount,
            cashSessionId: movement.cashSessionId,
          })),
          closedSessionIds,
        },
      })
      await tx.insert(domainEvents).values({
        organizationId: user.organizationId,
        eventType: 'sale.voided',
        payload: {
          saleId: sale.id,
          total: sale.total,
          reason,
          closedSessionIds,
        },
        occurredAt: voidedAt,
      })

      return { sale: updatedSale, closedSessionIds }
    })

    return NextResponse.json({
      sale: result.sale,
      warning: result.closedSessionIds.length > 0
        ? 'La caja de esta venta ya está cerrada. La anulación queda auditada, pero el cierre histórico no se recalcula.'
        : null,
    })
  } catch (error) {
    if (error instanceof FinanceError || error instanceof MoneyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof FinanceError ? error.status : 400 },
      )
    }
    logger.error('unhandled error in POST /api/sales/[id]/void', {
      requestId: req.headers.get('x-request-id'),
      organizationId: user.organizationId,
      saleId: id,
      error,
    })
    return NextResponse.json({ error: 'Ocurrió un error inesperado' }, { status: 500 })
  }
}
