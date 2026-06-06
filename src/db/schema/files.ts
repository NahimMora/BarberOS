import {
  bigint,
  pgEnum,
  pgTable,
  index,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { users } from './users'

export const fileCategoryEnum = pgEnum('file_category', [
  'client_photo',
  'barber_document',
  'medical_certificate',
  'contract',
  'other',
])

export const fileVisibilityEnum = pgEnum('file_visibility', [
  'admin_only',
  'staff_related',
  'public_profile',
])

export const files = pgTable('files', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  fileCategory: fileCategoryEnum('file_category').notNull(),
  visibility: fileVisibilityEnum('visibility').notNull().default('admin_only'),
  storageBucket: varchar('storage_bucket', { length: 100 }).notNull(),
  storagePath: varchar('storage_path', { length: 500 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('files_organization_entity_idx').on(
    table.organizationId,
    table.entityType,
    table.entityId,
  ),
  uniqueIndex('files_storage_path_idx').on(table.storageBucket, table.storagePath),
])

export type FileRecord = typeof files.$inferSelect
export type NewFileRecord = typeof files.$inferInsert
