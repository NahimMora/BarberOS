import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { files } from './files'

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  whatsappRaw: varchar('whatsapp_raw', { length: 50 }),
  whatsappE164: varchar('whatsapp_e164', { length: 20 }),
  phoneAltRaw: varchar('phone_alt_raw', { length: 50 }),
  phoneAltE164: varchar('phone_alt_e164', { length: 20 }),
  notes: text('notes'),
  cutPreferences: text('cut_preferences'),
  tags: text('tags').array(),
  extraProfile: jsonb('extra_profile'),
  photoFileId: uuid('photo_file_id').references(() => files.id),
  consentData: boolean('consent_data').notNull().default(false),
  consentDataAt: timestamp('consent_data_at', { withTimezone: true }),
  consentWhatsapp: boolean('consent_whatsapp').notNull().default(false),
  consentWhatsappAt: timestamp('consent_whatsapp_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Unique partial index: only when whatsapp_e164 is not null
  uniqueIndex('clients_org_whatsapp_e164_idx')
    .on(t.organizationId, t.whatsappE164)
    .where(sql`${t.whatsappE164} IS NOT NULL`),
  index('clients_org_id_idx').on(t.organizationId),
])

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
