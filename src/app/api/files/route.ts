import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { barberProfiles, clients, files } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const metadataSchema = z.object({
  entityType: z.enum(['barber_profile', 'client']),
  entityId: z.string().uuid(),
  fileCategory: z.enum([
    'client_photo',
    'barber_document',
    'medical_certificate',
    'contract',
    'other',
  ]),
  visibility: z.enum(['admin_only', 'staff_related', 'public_profile']).default('admin_only'),
})

const BUCKET = 'barberos-private'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

async function getAdmin() {
  const user = await getSession()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    requireRole(user, ['admin'])
  } catch {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(request: Request) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const url = new URL(request.url)
  const entityType = url.searchParams.get('entity_type')
  const entityId = url.searchParams.get('entity_id')
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entity_type y entity_id son requeridos' }, { status: 400 })
  }

  const rows = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.organizationId, auth.user.organizationId),
        eq(files.entityType, entityType),
        eq(files.entityId, entityId),
      ),
    )
    .orderBy(files.createdAt)
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response

  const formData = await request.formData()
  const file = formData.get('file')
  const parsed = metadataSchema.safeParse({
    entityType: formData.get('entityType'),
    entityId: formData.get('entityId'),
    fileCategory: formData.get('fileCategory'),
    visibility: formData.get('visibility') || 'admin_only',
  })
  if (!(file instanceof File) || !parsed.success) {
    return NextResponse.json({ error: 'Archivo o metadata inválida' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE || !ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Tipo o tamaño de archivo no permitido' }, { status: 400 })
  }
  if (
    ['barber_document', 'medical_certificate', 'contract'].includes(parsed.data.fileCategory) &&
    parsed.data.visibility !== 'admin_only'
  ) {
    return NextResponse.json({ error: 'Los documentos personales deben ser admin_only' }, { status: 400 })
  }
  const entityExists = parsed.data.entityType === 'barber_profile'
    ? await db
        .select({ id: barberProfiles.id })
        .from(barberProfiles)
        .where(
          and(
            eq(barberProfiles.organizationId, auth.user.organizationId),
            eq(barberProfiles.userId, parsed.data.entityId),
          ),
        )
        .limit(1)
    : await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.organizationId, auth.user.organizationId),
            eq(clients.id, parsed.data.entityId),
          ),
        )
        .limit(1)
  if (entityExists.length === 0) {
    return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${auth.user.organizationId}/${parsed.data.entityType}/${parsed.data.entityId}/${crypto.randomUUID()}-${safeName}`
  const supabaseAdmin = createSupabaseAdminClient()
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 })
  }

  try {
    const [record] = await db
      .insert(files)
      .values({
        organizationId: auth.user.organizationId,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        fileCategory: parsed.data.fileCategory,
        visibility: parsed.data.visibility,
        storageBucket: BUCKET,
        storagePath,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: auth.user.id,
      })
      .returning()
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath])
    throw error
  }
}
