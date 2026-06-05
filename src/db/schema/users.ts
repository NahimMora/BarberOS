import {
  pgTable,
  uuid,
  varchar,
  pgEnum,
  timestamp,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { branches } from './branches'

export const userRoleEnum = pgEnum('user_role', ['admin', 'receptionist', 'barber'])
export const userStatusEnum = pgEnum('user_status', ['active', 'invited', 'disabled'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  authId: uuid('auth_id').notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').notNull().default('active'),
  phone: varchar('phone', { length: 50 }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('users_auth_id_idx').on(t.authId),
])

export const userBranches = pgTable('user_branches', {
  userId: uuid('user_id').notNull().references(() => users.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.branchId] }),
])

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserBranch = typeof userBranches.$inferSelect
export type NewUserBranch = typeof userBranches.$inferInsert
