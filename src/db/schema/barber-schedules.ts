import {
  pgTable,
  uuid,
  integer,
  time,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { users } from './users'
import { branches } from './branches'

export const barberSchedules = pgTable('barber_schedules', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  barberId: uuid('barber_id').notNull().references(() => users.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  weekday: integer('weekday').notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const barberTimeOff = pgTable('barber_time_off', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  barberId: uuid('barber_id').notNull().references(() => users.id),
  branchId: uuid('branch_id').references(() => branches.id),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  reason: text('reason'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type BarberSchedule = typeof barberSchedules.$inferSelect
export type NewBarberSchedule = typeof barberSchedules.$inferInsert
export type BarberTimeOff = typeof barberTimeOff.$inferSelect
export type NewBarberTimeOff = typeof barberTimeOff.$inferInsert
