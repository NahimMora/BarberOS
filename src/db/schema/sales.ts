import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appointments } from './appointments'
import { branches } from './branches'
import { clients } from './clients'
import { organizations } from './organizations'
import { services } from './services'
import { users } from './users'

export const saleStatusEnum = pgEnum('sale_status', [
  'draft',
  'pending',
  'partially_paid',
  'paid',
  'cancelled',
])

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'transfer',
  'card',
  'mercadopago_manual',
  'other',
])

export const sales = pgTable('sales', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  barberId: uuid('barber_id').notNull().references(() => users.id),
  clientId: uuid('client_id').references(() => clients.id),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  status: saleStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('sales_appointment_id_idx')
    .on(table.appointmentId)
    .where(sql`${table.appointmentId} IS NOT NULL`),
  index('sales_organization_branch_created_idx').on(
    table.organizationId,
    table.branchId,
    table.createdAt,
  ),
  index('sales_organization_status_paid_idx').on(
    table.organizationId,
    table.status,
    table.paidAt,
  ),
  check('sales_amounts_nonnegative', sql`
    ${table.subtotal} >= 0
    AND ${table.discount} >= 0
    AND ${table.total} >= 0
  `),
  check('sales_total_matches', sql`${table.total} = ${table.subtotal} - ${table.discount}`),
  check('sales_paid_at_matches_status', sql`
    (${table.status} = 'paid' AND ${table.paidAt} IS NOT NULL)
    OR (${table.status} <> 'paid' AND ${table.paidAt} IS NULL)
  `),
])

export const saleItems = pgTable('sale_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  saleId: uuid('sale_id').notNull().references(() => sales.id),
  serviceId: uuid('service_id').notNull().references(() => services.id),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
}, (table) => [
  index('sale_items_organization_sale_idx').on(table.organizationId, table.saleId),
  check('sale_items_quantity_positive', sql`${table.quantity} > 0`),
  check('sale_items_amounts_nonnegative', sql`${table.unitPrice} >= 0 AND ${table.lineTotal} >= 0`),
  check('sale_items_total_matches', sql`${table.lineTotal} = ${table.unitPrice} * ${table.quantity}`),
])

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  saleId: uuid('sale_id').notNull().references(() => sales.id),
  method: paymentMethodEnum('method').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('payments_organization_sale_idx').on(table.organizationId, table.saleId),
  index('payments_organization_method_created_idx').on(
    table.organizationId,
    table.method,
    table.createdAt,
  ),
  check('payments_amount_positive', sql`${table.amount} > 0`),
])

export type Sale = typeof sales.$inferSelect
export type NewSale = typeof sales.$inferInsert
export type SaleItem = typeof saleItems.$inferSelect
export type Payment = typeof payments.$inferSelect
