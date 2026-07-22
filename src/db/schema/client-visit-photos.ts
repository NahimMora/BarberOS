import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'
import { branches } from './branches'
import { clients } from './clients'
import { appointments } from './appointments'
import { files } from './files'
import { users } from './users'

// Relación "qué foto de corte pertenece a qué cliente/visita". El binario y
// su metadata de storage viven en `files` (storage_provider = 'r2' para
// estas). branchId es siempre requerido (no depende de tener un turno
// asociado) para poder mostrar "dónde se cortó" aunque la foto se haya
// cargado a mano en recepción sin turno.
export const clientVisitPhotos = pgTable('client_visit_photos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  fileId: uuid('file_id').notNull().references(() => files.id),
  caption: text('caption'),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('client_visit_photos_org_client_idx').on(t.organizationId, t.clientId, t.createdAt),
])

export type ClientVisitPhoto = typeof clientVisitPhotos.$inferSelect
export type NewClientVisitPhoto = typeof clientVisitPhotos.$inferInsert
