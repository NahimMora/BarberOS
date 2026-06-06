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
import { MoneyError, parseMoney } from '@/lib/money/money'

const movementSchema = z.object({
  cashSessionId: z.string().uuid(),
  type: z.enum(['income', 'expense', 'withdrawal', 'adjustment']),
  amount: z.string().regex(/^-?\d{1,10}(?:\.\d{1,2})?$/),
  paymentMethod: z.enum(['cash', 'transfer', 'card', 'mercadopago_manual', 'other']),
  note: z.string().trim().min(3).max(500),
})

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = movementSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  try {
    const amount = parseMoney(data.amount)
    if (data.type === 'adjustment') {
      if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Solo el admin puede registrar ajustes' }, { status: 403 })
      }
      if (amount === 0n) throw new FinanceError('El ajuste no puede ser cero')
    } else if (amount <= 0n) {
      throw new FinanceError('El importe debe ser mayor a cero')
    }

    const [current] = await db
      .select()
      .from(cashSessions)
      .where(and(
        eq(cashSessions.id, data.cashSessionId),
        eq(cashSessions.organizationId, user.organizationId),
      ))
      .limit(1)
    if (!current) throw new FinanceError('Caja no encontrada', 404)
    if (!canManageCash(user, current.branchId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (data.type !== 'adjustment' && current.status !== 'open') {
      throw new FinanceError('Solo se pueden cargar movimientos en una caja abierta', 409)
    }

    const movement = await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(cashSessions)
        .where(and(
          eq(cashSessions.id, data.cashSessionId),
          eq(cashSessions.organizationId, user.organizationId),
        ))
        .limit(1)
        .for('update')
      if (!session) throw new FinanceError('Caja no encontrada', 404)
      if (data.type !== 'adjustment' && session.status !== 'open') {
        throw new FinanceError('La caja ya está cerrada', 409)
      }

      const [created] = await tx
        .insert(cashMovements)
        .values({
          organizationId: user.organizationId,
          cashSessionId: session.id,
          type: data.type,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          note: data.note,
          createdBy: user.id,
        })
        .returning()

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        userId: user.id,
        action: `cash.${data.type}`,
        entity: 'cash_movements',
        entityId: created.id,
        diff: {
          cashSessionId: session.id,
          branchId: session.branchId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          note: data.note,
          sessionStatus: session.status,
        },
      })
      await tx.insert(domainEvents).values({
        organizationId: user.organizationId,
        eventType: `cash.${data.type}`,
        payload: {
          cashMovementId: created.id,
          cashSessionId: session.id,
          branchId: session.branchId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
        },
        occurredAt: created.createdAt,
      })

      return created
    })

    return NextResponse.json(movement, { status: 201 })
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
