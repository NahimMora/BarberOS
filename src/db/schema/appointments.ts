import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { branches } from './branches'
import { users } from './users'
import { clients } from './clients'
import { services } from './services'

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
])

export const appointmentSourceEnum = pgEnum('appointment_source', [
  'booked',
  'walk_in',
])

export const appointmentHistoryActionEnum = pgEnum('appointment_history_action', [
  'created',
  'rescheduled',
  'cancelled',
  'status_changed',
  'barber_changed',
])

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  barberId: uuid('barber_id').notNull().references(() => users.id),
  clientId: uuid('client_id').references(() => clients.id),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  status: appointmentStatusEnum('status').notNull().default('scheduled'),
  source: appointmentSourceEnum('source').notNull().default('booked'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  cancelReason: text('cancel_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('appointments_organization_branch_start_idx').on(
    table.organizationId,
    table.branchId,
    table.startAt,
  ),
  index('appointments_organization_barber_start_idx').on(
    table.organizationId,
    table.barberId,
    table.startAt,
  ),
])

export const appointmentServices = pgTable('appointment_services', {
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id),
  serviceId: uuid('service_id').notNull().references(() => services.id),
  priceAtTime: numeric('price_at_time', { precision: 12, scale: 2 }).notNull(),
  durationAtTime: integer('duration_at_time').notNull(),
}, (table) => [
  primaryKey({ columns: [table.appointmentId, table.serviceId] }),
])

export const appointmentHistory = pgTable('appointment_history', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id),
  action: appointmentHistoryActionEnum('action').notNull(),
  fromStatus: appointmentStatusEnum('from_status'),
  toStatus: appointmentStatusEnum('to_status'),
  fromStartAt: timestamp('from_start_at', { withTimezone: true }),
  toStartAt: timestamp('to_start_at', { withTimezone: true }),
  fromEndAt: timestamp('from_end_at', { withTimezone: true }),
  toEndAt: timestamp('to_end_at', { withTimezone: true }),
  fromBarberId: uuid('from_barber_id'),
  toBarberId: uuid('to_barber_id'),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  userId: uuid('user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Appointment = typeof appointments.$inferSelect
export type NewAppointment = typeof appointments.$inferInsert
export type AppointmentService = typeof appointmentServices.$inferSelect
export type NewAppointmentService = typeof appointmentServices.$inferInsert
export type AppointmentHistory = typeof appointmentHistory.$inferSelect
export type NewAppointmentHistory = typeof appointmentHistory.$inferInsert
