import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const organizationSettings = pgTable('organization_settings', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  currency: varchar('currency', { length: 3 }).notNull().default('ARS'),
  defaultTimezone: varchar('default_timezone', { length: 100 }).notNull().default('America/Argentina/Buenos_Aires'),
  slotIntervalMinutes: integer('slot_interval_minutes').notNull().default(30),
  defaultAppointmentBufferMinutes: integer('default_appointment_buffer_minutes').notNull().default(5),
  defaultCommissionRate: numeric('default_commission_rate', { precision: 5, scale: 2 }).notNull().default('0.00'),
  allowBarberCharge: boolean('allow_barber_charge').notNull().default(true),
  allowAnonymousWalkin: boolean('allow_anonymous_walkin').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('organization_settings_organization_id_idx').on(table.organizationId),
])

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type OrganizationSettings = typeof organizationSettings.$inferSelect
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert
