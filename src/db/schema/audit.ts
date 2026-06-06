import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  pgEnum,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'

export const systemEventLevelEnum = pgEnum('system_event_level', ['info', 'warn', 'error'])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id'),
  action: varchar('action', { length: 100 }).notNull(),
  entity: varchar('entity', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  diff: jsonb('diff'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_logs_organization_created_idx').on(table.organizationId, table.createdAt),
])

export const domainEvents = pgTable('domain_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('domain_events_organization_occurred_idx').on(
    table.organizationId,
    table.occurredAt,
  ),
])

export const systemEvents = pgTable('system_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  level: systemEventLevelEnum('level').notNull().default('info'),
  source: varchar('source', { length: 100 }),
  message: text('message').notNull(),
  context: jsonb('context'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('system_events_level_created_idx').on(table.level, table.createdAt),
])

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type DomainEvent = typeof domainEvents.$inferSelect
export type NewDomainEvent = typeof domainEvents.$inferInsert
export type SystemEvent = typeof systemEvents.$inferSelect
export type NewSystemEvent = typeof systemEvents.$inferInsert
