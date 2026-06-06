import {
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { branches } from './branches'
import { organizations } from './organizations'
import { paymentMethodEnum, sales } from './sales'
import { users } from './users'

export const cashSessionStatusEnum = pgEnum('cash_session_status', [
  'open',
  'closed',
  'reconciled',
])

export const cashMovementTypeEnum = pgEnum('cash_movement_type', [
  'sale',
  'income',
  'expense',
  'withdrawal',
  'adjustment',
])

export const cashSessions = pgTable('cash_sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  openedBy: uuid('opened_by').notNull().references(() => users.id),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  openingAmount: numeric('opening_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  closedBy: uuid('closed_by').references(() => users.id),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  expectedCash: numeric('expected_cash', { precision: 12, scale: 2 }),
  expectedTransfer: numeric('expected_transfer', { precision: 12, scale: 2 }),
  expectedCard: numeric('expected_card', { precision: 12, scale: 2 }),
  expectedMercadopagoManual: numeric('expected_mercadopago_manual', { precision: 12, scale: 2 }),
  expectedOther: numeric('expected_other', { precision: 12, scale: 2 }),
  expectedTotal: numeric('expected_total', { precision: 12, scale: 2 }),
  countedCash: numeric('counted_cash', { precision: 12, scale: 2 }),
  cashDifference: numeric('cash_difference', { precision: 12, scale: 2 }),
  status: cashSessionStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('cash_sessions_one_open_per_branch_idx')
    .on(table.branchId)
    .where(sql`${table.status} = 'open'`),
  index('cash_sessions_organization_branch_opened_idx').on(
    table.organizationId,
    table.branchId,
    table.openedAt,
  ),
  check('cash_sessions_opening_nonnegative', sql`${table.openingAmount} >= 0`),
  check('cash_sessions_counted_nonnegative', sql`${table.countedCash} IS NULL OR ${table.countedCash} >= 0`),
  check('cash_sessions_state_valid', sql`
    (
      ${table.status} = 'open'
      AND ${table.closedBy} IS NULL
      AND ${table.closedAt} IS NULL
      AND ${table.expectedCash} IS NULL
      AND ${table.expectedTransfer} IS NULL
      AND ${table.expectedCard} IS NULL
      AND ${table.expectedMercadopagoManual} IS NULL
      AND ${table.expectedOther} IS NULL
      AND ${table.expectedTotal} IS NULL
      AND ${table.countedCash} IS NULL
      AND ${table.cashDifference} IS NULL
    )
    OR (
      ${table.status} IN ('closed', 'reconciled')
      AND ${table.closedBy} IS NOT NULL
      AND ${table.closedAt} IS NOT NULL
      AND ${table.expectedCash} IS NOT NULL
      AND ${table.expectedTransfer} IS NOT NULL
      AND ${table.expectedCard} IS NOT NULL
      AND ${table.expectedMercadopagoManual} IS NOT NULL
      AND ${table.expectedOther} IS NOT NULL
      AND ${table.expectedTotal} IS NOT NULL
      AND ${table.countedCash} IS NOT NULL
      AND ${table.cashDifference} = ${table.countedCash} - ${table.expectedCash}
    )
  `),
])

export const cashMovements = pgTable('cash_movements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  cashSessionId: uuid('cash_session_id').notNull().references(() => cashSessions.id),
  type: cashMovementTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  referenceSaleId: uuid('reference_sale_id').references(() => sales.id),
  note: text('note'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('cash_movements_organization_session_created_idx').on(
    table.organizationId,
    table.cashSessionId,
    table.createdAt,
  ),
  index('cash_movements_reference_sale_idx').on(table.referenceSaleId),
  uniqueIndex('cash_movements_sale_method_idx')
    .on(table.referenceSaleId, table.paymentMethod)
    .where(sql`${table.type} = 'sale' AND ${table.referenceSaleId} IS NOT NULL`),
  check('cash_movements_amount_valid', sql`
    (${table.type} = 'adjustment' AND ${table.amount} <> 0)
    OR (${table.type} <> 'adjustment' AND ${table.amount} > 0)
  `),
  check('cash_movements_sale_reference', sql`
    (${table.type} = 'sale' AND ${table.referenceSaleId} IS NOT NULL)
    OR (${table.type} <> 'sale' AND ${table.referenceSaleId} IS NULL)
  `),
])

export type CashSession = typeof cashSessions.$inferSelect
export type CashMovement = typeof cashMovements.$inferSelect
