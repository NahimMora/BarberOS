import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  appointments,
  appointmentServices,
  auditLogs,
  barberProfiles,
  branches,
  cashMovements,
  cashSessions,
  clients,
  commissions,
  domainEvents,
  organizationSettings,
  payments,
  saleItems,
  sales,
  services,
  userBranches,
  users,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { hasBranchAccess } from '@/lib/auth/authorization'
import { canChargeSale } from '@/lib/finance/authorization'
import { getCommissionPeriod } from '@/lib/finance/commission-period'
import { FinanceError } from '@/lib/finance/errors'
import {
  calculateCommission,
  calculateSaleTotals,
  formatCents,
  MoneyError,
  parseMoney,
} from '@/lib/money/money'

const paymentMethods = ['cash', 'transfer', 'card', 'mercadopago_manual', 'other'] as const

const saleSchema = z.object({
  branchId: z.string().uuid(),
  barberId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  discount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).default('0.00'),
  paymentMethod: z.enum(paymentMethods),
  paymentNote: z.string().trim().max(500).nullable().optional(),
  items: z.array(z.object({
    serviceId: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
  })).min(1).max(20).optional(),
}).superRefine((data, context) => {
  if (!data.appointmentId && !data.items) {
    context.addIssue({
      code: 'custom',
      path: ['items'],
      message: 'La venta manual requiere al menos un servicio',
    })
  }
  if (data.items) {
    const ids = data.items.map((item) => item.serviceId)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'No repitas servicios; ajustá la cantidad',
      })
    }
  }
})

export async function GET(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const branchId = new URL(req.url).searchParams.get('branch_id')
  const conditions = [eq(sales.organizationId, user.organizationId)]

  if (branchId) {
    if (!hasBranchAccess(user, branchId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    conditions.push(eq(sales.branchId, branchId))
  } else if (user.role !== 'admin') {
    if (user.branchIds.length === 0) return NextResponse.json([])
    conditions.push(inArray(sales.branchId, user.branchIds))
  }
  if (user.role === 'barber') {
    conditions.push(eq(sales.barberId, user.id))
  }

  const rows = await db
    .select({
      id: sales.id,
      branchId: sales.branchId,
      appointmentId: sales.appointmentId,
      barberId: sales.barberId,
      clientId: sales.clientId,
      subtotal: sales.subtotal,
      discount: sales.discount,
      total: sales.total,
      status: sales.status,
      paidAt: sales.paidAt,
      paymentMethod: payments.method,
      paymentAmount: payments.amount,
    })
    .from(sales)
    .leftJoin(payments, eq(payments.saleId, sales.id))
    .where(and(...conditions))
    .orderBy(desc(sales.createdAt))
    .limit(100)

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = saleSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  try {
    const [settings] = await db
      .select({
        allowBarberCharge: organizationSettings.allowBarberCharge,
        allowAnonymousWalkin: organizationSettings.allowAnonymousWalkin,
        defaultCommissionRate: organizationSettings.defaultCommissionRate,
        defaultTimezone: organizationSettings.defaultTimezone,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, user.organizationId))
      .limit(1)

    const allowBarberCharge = settings?.allowBarberCharge ?? false
    if (!canChargeSale(user, data.branchId, data.barberId, allowBarberCharge)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(
        eq(branches.id, data.branchId),
        eq(branches.organizationId, user.organizationId),
        eq(branches.active, true),
        isNull(branches.deletedAt),
      ))
      .limit(1)
    if (!branch) throw new FinanceError('Sucursal no encontrada', 404)

    const [barber] = await db
      .select({
        id: users.id,
        commissionRate: barberProfiles.commissionRate,
      })
      .from(users)
      .innerJoin(
        userBranches,
        and(
          eq(userBranches.userId, users.id),
          eq(userBranches.branchId, data.branchId),
          eq(userBranches.organizationId, user.organizationId),
        ),
      )
      .leftJoin(
        barberProfiles,
        and(
          eq(barberProfiles.userId, users.id),
          eq(barberProfiles.organizationId, user.organizationId),
          eq(barberProfiles.active, true),
          isNull(barberProfiles.deletedAt),
        ),
      )
      .where(and(
        eq(users.id, data.barberId),
        eq(users.organizationId, user.organizationId),
        eq(users.role, 'barber'),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
      ))
      .limit(1)
    if (!barber) throw new FinanceError('Barbero no disponible en la sucursal')

    let appointmentClientId: string | null = null
    let requestedItems: { serviceId: string; quantity: number; description: string; unitPrice: string }[]

    if (data.appointmentId) {
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(and(
          eq(appointments.id, data.appointmentId),
          eq(appointments.organizationId, user.organizationId),
        ))
        .limit(1)
      if (!appointment) throw new FinanceError('Turno no encontrado', 404)
      if (appointment.branchId !== data.branchId || appointment.barberId !== data.barberId) {
        throw new FinanceError('El turno no coincide con la sucursal o el barbero')
      }
      if (appointment.status !== 'completed') {
        throw new FinanceError('Completá el turno antes de cobrarlo', 422)
      }
      appointmentClientId = appointment.clientId

      const appointmentItemRows = await db
        .select({
          serviceId: appointmentServices.serviceId,
          description: services.name,
          unitPrice: appointmentServices.priceAtTime,
        })
        .from(appointmentServices)
        .innerJoin(services, eq(services.id, appointmentServices.serviceId))
        .where(and(
          eq(appointmentServices.appointmentId, appointment.id),
          eq(appointmentServices.organizationId, user.organizationId),
        ))
      if (appointmentItemRows.length === 0) {
        throw new FinanceError('El turno no tiene servicios para cobrar')
      }
      requestedItems = appointmentItemRows.map((item) => ({ ...item, quantity: 1 }))
    } else {
      const itemInputs = data.items ?? []
      const serviceRows = await db
        .select({
          serviceId: services.id,
          description: services.name,
          unitPrice: services.price,
        })
        .from(services)
        .where(and(
          eq(services.organizationId, user.organizationId),
          inArray(services.id, itemInputs.map((item) => item.serviceId)),
          eq(services.active, true),
          isNull(services.deletedAt),
        ))
      if (serviceRows.length !== itemInputs.length) {
        throw new FinanceError('Uno o más servicios no están disponibles')
      }
      const quantityByService = new Map(
        itemInputs.map((item) => [item.serviceId, item.quantity]),
      )
      requestedItems = serviceRows.map((service) => ({
        ...service,
        quantity: quantityByService.get(service.serviceId) ?? 1,
      }))
    }

    const clientId = data.clientId ?? appointmentClientId
    if (data.appointmentId && data.clientId && data.clientId !== appointmentClientId) {
      throw new FinanceError('El cliente no coincide con el turno')
    }
    if (clientId) {
      const [client] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(
          eq(clients.id, clientId),
          eq(clients.organizationId, user.organizationId),
          eq(clients.active, true),
          isNull(clients.deletedAt),
        ))
        .limit(1)
      if (!client) throw new FinanceError('Cliente no encontrado')
    } else if (!settings?.allowAnonymousWalkin) {
      throw new FinanceError('Los cobros anónimos no están habilitados', 403)
    }

    const totals = calculateSaleTotals(
      requestedItems.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      data.discount,
    )
    if (parseMoney(totals.total) <= 0n) {
      throw new FinanceError('El total de la venta debe ser mayor a cero')
    }

    const paidAt = new Date()
    const rateSnapshot = barber.commissionRate
      ?? settings?.defaultCommissionRate
      ?? '0.00'
    const missingCommissionRate = barber.commissionRate === null
      && (!settings || settings.defaultCommissionRate === '0.00')
    const commissionAmount = calculateCommission(totals.total, rateSnapshot)
    const period = getCommissionPeriod(
      paidAt,
      settings?.defaultTimezone ?? 'America/Argentina/Buenos_Aires',
    )

    const result = await db.transaction(async (tx) => {
      const [cashSession] = await tx
        .select({ id: cashSessions.id })
        .from(cashSessions)
        .where(and(
          eq(cashSessions.organizationId, user.organizationId),
          eq(cashSessions.branchId, data.branchId),
          eq(cashSessions.status, 'open'),
        ))
        .limit(1)
        .for('update')
      if (!cashSession) {
        throw new FinanceError('Abrí la caja de la sucursal antes de cobrar', 409)
      }

      const [sale] = await tx
        .insert(sales)
        .values({
          organizationId: user.organizationId,
          branchId: data.branchId,
          appointmentId: data.appointmentId ?? null,
          barberId: data.barberId,
          clientId,
          subtotal: totals.subtotal,
          discount: totals.discount,
          total: totals.total,
          status: 'paid',
          createdBy: user.id,
          paidAt,
        })
        .returning()

      await tx.insert(saleItems).values(requestedItems.map((item) => ({
        organizationId: user.organizationId,
        saleId: sale.id,
        serviceId: item.serviceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: formatCents(parseMoney(item.unitPrice) * BigInt(item.quantity)),
      })))

      const [payment] = await tx
        .insert(payments)
        .values({
          organizationId: user.organizationId,
          saleId: sale.id,
          method: data.paymentMethod,
          amount: totals.total,
          note: data.paymentNote ?? null,
          createdBy: user.id,
        })
        .returning()

      await tx.insert(cashMovements).values({
        organizationId: user.organizationId,
        cashSessionId: cashSession.id,
        type: 'sale',
        amount: totals.total,
        paymentMethod: data.paymentMethod,
        referenceSaleId: sale.id,
        note: data.appointmentId ? 'Cobro de turno' : 'Venta manual',
        createdBy: user.id,
      })

      const [commission] = await tx
        .insert(commissions)
        .values({
          organizationId: user.organizationId,
          barberId: data.barberId,
          saleId: sale.id,
          baseAmount: totals.total,
          rateSnapshot,
          commissionAmount,
          period,
        })
        .returning()

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'sale.paid',
        entity: 'sales',
        entityId: sale.id,
        diff: {
          branchId: data.branchId,
          barberId: data.barberId,
          appointmentId: data.appointmentId ?? null,
          subtotal: totals.subtotal,
          discount: totals.discount,
          total: totals.total,
          paymentMethod: data.paymentMethod,
          cashSessionId: cashSession.id,
          commissionRate: rateSnapshot,
          commissionAmount,
        },
      })

      await tx.insert(domainEvents).values({
        organizationId: user.organizationId,
        eventType: 'sale.paid',
        payload: {
          saleId: sale.id,
          branchId: data.branchId,
          barberId: data.barberId,
          total: totals.total,
          paymentMethod: data.paymentMethod,
        },
        occurredAt: paidAt,
      })

      return { sale, payment, commission, cashSessionId: cashSession.id }
    })

    return NextResponse.json({
      ...result,
      warning: missingCommissionRate
        ? 'El barbero no tiene comisión configurada; se aplicó 0%.'
        : null,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof FinanceError || error instanceof MoneyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof FinanceError ? error.status : 400 },
      )
    }
    const pgError = error as { code?: string; constraint_name?: string }
    if (pgError.code === '23505' && pgError.constraint_name === 'sales_appointment_id_idx') {
      return NextResponse.json({ error: 'El turno ya fue cobrado' }, { status: 409 })
    }
    throw error
  }
}
