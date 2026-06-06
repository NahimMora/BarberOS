import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  auditLogs,
  branches,
  cashSessions,
  clients,
  commissions,
  domainEvents,
  payments,
  sales,
  systemEvents,
  users,
} from '@/db/schema'
import type { AppUser } from '@/lib/auth/get-session'
import { getLocalMonthUtcRange } from '@/lib/datetime/local-day-range'
import { db } from '@/lib/db'
import type { ExportCell, SpreadsheetColumn } from './serialize'

export const exportResources = [
  'sales',
  'commissions',
  'cash',
  'clients',
  'audit',
  'domain-events',
  'system-events',
] as const

export type ExportResource = (typeof exportResources)[number]

export type ExportDefinition = {
  filename: string
  sheetName: string
  columns: SpreadsheetColumn[]
  rows: ExportCell[][]
}

type ExportContext = {
  user: AppUser
  resource: ExportResource
  period: string
  branchId?: string
  timeZone: string
}

export function canExportResource(
  role: AppUser['role'],
  resource: ExportResource,
): boolean {
  if (role === 'barber') return false
  if (role === 'admin') return true
  return resource === 'sales' || resource === 'cash' || resource === 'clients'
}

export async function buildExport(context: ExportContext): Promise<ExportDefinition> {
  if (!canExportResource(context.user.role, context.resource)) {
    throw new ExportAuthorizationError()
  }

  switch (context.resource) {
    case 'sales':
      return buildSalesExport(context)
    case 'commissions':
      return buildCommissionsExport(context)
    case 'cash':
      return buildCashExport(context)
    case 'clients':
      return buildClientsExport(context)
    case 'audit':
      return buildAuditExport(context)
    case 'domain-events':
      return buildDomainEventsExport(context)
    case 'system-events':
      return buildSystemEventsExport(context)
  }
}

async function buildSalesExport(context: ExportContext): Promise<ExportDefinition> {
  const range = getLocalMonthUtcRange(context.period, context.timeZone)
  const conditions: SQL[] = [
    eq(sales.organizationId, context.user.organizationId),
    eq(sales.status, 'paid'),
    gte(sales.paidAt, range.start),
    lt(sales.paidAt, range.end),
    ...branchConditions(sales.branchId, context),
  ]

  const rows = await db
    .select({
      id: sales.id,
      paidAt: sales.paidAt,
      branchName: branches.name,
      barberName: users.fullName,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      subtotal: sales.subtotal,
      discount: sales.discount,
      total: sales.total,
      method: payments.method,
      status: sales.status,
    })
    .from(sales)
    .innerJoin(branches, eq(branches.id, sales.branchId))
    .innerJoin(users, eq(users.id, sales.barberId))
    .leftJoin(clients, eq(clients.id, sales.clientId))
    .leftJoin(payments, eq(payments.saleId, sales.id))
    .where(and(...conditions))
    .orderBy(asc(sales.paidAt))
    .limit(10_000)

  return {
    filename: `ventas-${context.period}`,
    sheetName: 'Ventas',
    columns: [
      stringColumn('Fecha'),
      stringColumn('Sucursal'),
      stringColumn('Venta'),
      stringColumn('Cliente'),
      stringColumn('Barbero'),
      numberColumn('Subtotal'),
      numberColumn('Descuento'),
      numberColumn('Total'),
      stringColumn('Método'),
      stringColumn('Estado'),
    ],
    rows: rows.map((row) => [
      formatDate(row.paidAt, context.timeZone),
      row.branchName,
      row.id,
      fullName(row.clientFirstName, row.clientLastName, 'Sin cliente'),
      row.barberName,
      row.subtotal,
      row.discount,
      row.total,
      paymentMethodLabel(row.method),
      'Pagada',
    ]),
  }
}

async function buildCommissionsExport(context: ExportContext): Promise<ExportDefinition> {
  const conditions: SQL[] = [
    eq(commissions.organizationId, context.user.organizationId),
    eq(commissions.period, context.period),
    ne(commissions.status, 'cancelled'),
    ...branchConditions(sales.branchId, context),
  ]

  const rows = await db
    .select({
      paidAt: sales.paidAt,
      branchName: branches.name,
      barberName: users.fullName,
      saleId: commissions.saleId,
      baseAmount: commissions.baseAmount,
      rateSnapshot: commissions.rateSnapshot,
      commissionAmount: commissions.commissionAmount,
      status: commissions.status,
    })
    .from(commissions)
    .innerJoin(sales, eq(sales.id, commissions.saleId))
    .innerJoin(branches, eq(branches.id, sales.branchId))
    .innerJoin(users, eq(users.id, commissions.barberId))
    .where(and(...conditions))
    .orderBy(asc(users.fullName), asc(sales.paidAt))
    .limit(10_000)

  return {
    filename: `comisiones-${context.period}`,
    sheetName: 'Comisiones',
    columns: [
      stringColumn('Fecha'),
      stringColumn('Sucursal'),
      stringColumn('Barbero'),
      stringColumn('Venta'),
      numberColumn('Base neta'),
      numberColumn('Tasa %'),
      numberColumn('Comisión'),
      stringColumn('Estado'),
    ],
    rows: rows.map((row) => [
      formatDate(row.paidAt, context.timeZone),
      row.branchName,
      row.barberName,
      row.saleId,
      row.baseAmount,
      row.rateSnapshot,
      row.commissionAmount,
      row.status === 'paid' ? 'Liquidada' : 'Pendiente',
    ]),
  }
}

async function buildCashExport(context: ExportContext): Promise<ExportDefinition> {
  const range = getLocalMonthUtcRange(context.period, context.timeZone)
  const conditions: SQL[] = [
    eq(cashSessions.organizationId, context.user.organizationId),
    gte(cashSessions.openedAt, range.start),
    lt(cashSessions.openedAt, range.end),
    ...branchConditions(cashSessions.branchId, context),
  ]

  const rows = await db
    .select({
      id: cashSessions.id,
      branchName: branches.name,
      openedAt: cashSessions.openedAt,
      closedAt: cashSessions.closedAt,
      status: cashSessions.status,
      openingAmount: cashSessions.openingAmount,
      expectedCash: cashSessions.expectedCash,
      expectedTransfer: cashSessions.expectedTransfer,
      expectedCard: cashSessions.expectedCard,
      expectedMercadopagoManual: cashSessions.expectedMercadopagoManual,
      expectedOther: cashSessions.expectedOther,
      expectedTotal: cashSessions.expectedTotal,
      countedCash: cashSessions.countedCash,
      cashDifference: cashSessions.cashDifference,
    })
    .from(cashSessions)
    .innerJoin(branches, eq(branches.id, cashSessions.branchId))
    .where(and(...conditions))
    .orderBy(asc(cashSessions.openedAt))
    .limit(10_000)

  return {
    filename: `caja-${context.period}`,
    sheetName: 'Caja',
    columns: [
      stringColumn('Sesión'),
      stringColumn('Sucursal'),
      stringColumn('Apertura'),
      stringColumn('Cierre'),
      stringColumn('Estado'),
      numberColumn('Fondo inicial'),
      numberColumn('Efectivo esperado'),
      numberColumn('Transferencias'),
      numberColumn('Tarjetas'),
      numberColumn('MercadoPago manual'),
      numberColumn('Otros'),
      numberColumn('Total esperado'),
      numberColumn('Efectivo contado'),
      numberColumn('Diferencia'),
    ],
    rows: rows.map((row) => [
      row.id,
      row.branchName,
      formatDate(row.openedAt, context.timeZone),
      formatDate(row.closedAt, context.timeZone),
      cashStatusLabel(row.status),
      row.openingAmount,
      row.expectedCash,
      row.expectedTransfer,
      row.expectedCard,
      row.expectedMercadopagoManual,
      row.expectedOther,
      row.expectedTotal,
      row.countedCash,
      row.cashDifference,
    ]),
  }
}

async function buildClientsExport(context: ExportContext): Promise<ExportDefinition> {
  const rows = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      whatsappRaw: clients.whatsappRaw,
      whatsappE164: clients.whatsappE164,
      phoneAltRaw: clients.phoneAltRaw,
      phoneAltE164: clients.phoneAltE164,
      cutPreferences: clients.cutPreferences,
      notes: clients.notes,
      consentData: clients.consentData,
      consentWhatsapp: clients.consentWhatsapp,
      active: clients.active,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(and(
      eq(clients.organizationId, context.user.organizationId),
      isNull(clients.deletedAt),
    ))
    .orderBy(asc(clients.lastName), asc(clients.firstName))
    .limit(10_000)

  return {
    filename: 'clientes',
    sheetName: 'Clientes',
    columns: [
      stringColumn('Cliente'),
      stringColumn('Nombre'),
      stringColumn('Apellido'),
      stringColumn('WhatsApp original'),
      stringColumn('WhatsApp E.164'),
      stringColumn('Teléfono alternativo'),
      stringColumn('Teléfono alternativo E.164'),
      stringColumn('Preferencias de corte'),
      stringColumn('Notas'),
      stringColumn('Consentimiento de datos'),
      stringColumn('Consentimiento WhatsApp'),
      stringColumn('Estado'),
      stringColumn('Alta'),
    ],
    rows: rows.map((row) => [
      row.id,
      row.firstName,
      row.lastName,
      row.whatsappRaw,
      row.whatsappE164,
      row.phoneAltRaw,
      row.phoneAltE164,
      row.cutPreferences,
      row.notes,
      yesNo(row.consentData),
      yesNo(row.consentWhatsapp),
      row.active ? 'Activo' : 'Inactivo',
      formatDate(row.createdAt, context.timeZone),
    ]),
  }
}

async function buildAuditExport(context: ExportContext): Promise<ExportDefinition> {
  const range = getLocalMonthUtcRange(context.period, context.timeZone)
  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      actor: users.fullName,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      diff: auditLogs.diff,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(
      eq(auditLogs.organizationId, context.user.organizationId),
      gte(auditLogs.createdAt, range.start),
      lt(auditLogs.createdAt, range.end),
    ))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10_000)

  return {
    filename: `auditoria-${context.period}`,
    sheetName: 'Auditoria',
    columns: [
      stringColumn('Fecha'),
      stringColumn('Actor'),
      stringColumn('Acción'),
      stringColumn('Entidad'),
      stringColumn('Entidad ID'),
      stringColumn('Cambios'),
    ],
    rows: rows.map((row) => [
      formatDate(row.createdAt, context.timeZone),
      row.actor ?? 'Sistema',
      row.action,
      row.entity,
      row.entityId,
      jsonCell(row.diff),
    ]),
  }
}

async function buildDomainEventsExport(context: ExportContext): Promise<ExportDefinition> {
  const range = getLocalMonthUtcRange(context.period, context.timeZone)
  const rows = await db
    .select()
    .from(domainEvents)
    .where(and(
      eq(domainEvents.organizationId, context.user.organizationId),
      gte(domainEvents.occurredAt, range.start),
      lt(domainEvents.occurredAt, range.end),
    ))
    .orderBy(desc(domainEvents.occurredAt))
    .limit(10_000)

  return {
    filename: `eventos-negocio-${context.period}`,
    sheetName: 'Eventos negocio',
    columns: [
      stringColumn('Fecha'),
      stringColumn('Tipo'),
      stringColumn('Datos'),
    ],
    rows: rows.map((row) => [
      formatDate(row.occurredAt, context.timeZone),
      row.eventType,
      jsonCell(row.payload),
    ]),
  }
}

async function buildSystemEventsExport(context: ExportContext): Promise<ExportDefinition> {
  const range = getLocalMonthUtcRange(context.period, context.timeZone)
  const rows = await db
    .select()
    .from(systemEvents)
    .where(and(
      sql`${systemEvents.context}->>'organizationId' = ${context.user.organizationId}`,
      gte(systemEvents.createdAt, range.start),
      lt(systemEvents.createdAt, range.end),
    ))
    .orderBy(desc(systemEvents.createdAt))
    .limit(10_000)

  return {
    filename: `eventos-sistema-${context.period}`,
    sheetName: 'Eventos sistema',
    columns: [
      stringColumn('Fecha'),
      stringColumn('Nivel'),
      stringColumn('Fuente'),
      stringColumn('Mensaje'),
      stringColumn('Contexto'),
    ],
    rows: rows.map((row) => [
      formatDate(row.createdAt, context.timeZone),
      row.level,
      row.source,
      row.message,
      jsonCell(row.context),
    ]),
  }
}

function branchConditions(
  column: typeof sales.branchId | typeof cashSessions.branchId,
  context: ExportContext,
): SQL[] {
  if (context.branchId) return [eq(column, context.branchId)]
  if (context.user.role === 'receptionist') {
    return context.user.branchIds.length > 0
      ? [inArray(column, context.user.branchIds)]
      : [sql`false`]
  }
  return []
}

function stringColumn(label: string): SpreadsheetColumn {
  return { label, type: 'string' }
}

function numberColumn(label: string): SpreadsheetColumn {
  return { label, type: 'number' }
}

function formatDate(date: Date | null, timeZone: string): string {
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`
}

function fullName(
  firstName: string | null,
  lastName: string | null,
  fallback: string,
): string {
  return [firstName, lastName].filter(Boolean).join(' ') || fallback
}

function paymentMethodLabel(method: typeof payments.$inferSelect.method | null): string {
  const labels = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    mercadopago_manual: 'MercadoPago manual',
    other: 'Otro',
  }
  return method ? labels[method] : 'Sin método'
}

function cashStatusLabel(status: typeof cashSessions.$inferSelect.status): string {
  return status === 'open' ? 'Abierta' : status === 'closed' ? 'Cerrada' : 'Reconciliada'
}

function yesNo(value: boolean): string {
  return value ? 'Sí' : 'No'
}

function jsonCell(value: unknown): string {
  return value === null || value === undefined ? '' : JSON.stringify(value)
}

export class ExportAuthorizationError extends Error {
  constructor() {
    super('Forbidden')
    this.name = 'ExportAuthorizationError'
  }
}
