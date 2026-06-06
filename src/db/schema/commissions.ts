import {
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { sales } from './sales'
import { users } from './users'

export const commissionStatusEnum = pgEnum('commission_status', [
  'pending',
  'paid',
  'cancelled',
])

export const commissions = pgTable('commissions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  barberId: uuid('barber_id').notNull().references(() => users.id),
  saleId: uuid('sale_id').notNull().references(() => sales.id),
  baseAmount: numeric('base_amount', { precision: 12, scale: 2 }).notNull(),
  rateSnapshot: numeric('rate_snapshot', { precision: 5, scale: 2 }).notNull(),
  commissionAmount: numeric('commission_amount', { precision: 12, scale: 2 }).notNull(),
  period: varchar('period', { length: 7 }).notNull(),
  status: commissionStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('commissions_sale_id_idx').on(table.saleId),
  index('commissions_organization_barber_period_idx').on(
    table.organizationId,
    table.barberId,
    table.period,
  ),
  index('commissions_organization_period_status_idx').on(
    table.organizationId,
    table.period,
    table.status,
  ),
  check('commissions_amounts_nonnegative', sql`
    ${table.baseAmount} >= 0
    AND ${table.commissionAmount} >= 0
  `),
  check('commissions_rate_valid', sql`${table.rateSnapshot} >= 0 AND ${table.rateSnapshot} <= 100`),
  check('commissions_period_format', sql`${table.period} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
])

export type Commission = typeof commissions.$inferSelect
