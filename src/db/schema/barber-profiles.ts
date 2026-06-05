import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  date,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { users } from './users'

export const relationshipTypeEnum = pgEnum('relationship_type', [
  'empleado',
  'socio',
  'monotributista',
  'colaborador',
])

export const barberProfiles = pgTable('barber_profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 50 }),
  hireDate: date('hire_date'),
  relationshipType: relationshipTypeEnum('relationship_type'),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 2 }),
  medicalCertExpiry: date('medical_cert_expiry'),
  documentationExpiry: date('documentation_expiry'),
  internalNotes: text('internal_notes'),
  displayColor: varchar('display_color', { length: 7 }),
  active: boolean('active').notNull().default(true),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type BarberProfile = typeof barberProfiles.$inferSelect
export type NewBarberProfile = typeof barberProfiles.$inferInsert
