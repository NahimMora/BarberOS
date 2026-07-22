import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, branches, appointments, files, clientVisitPhotos } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { hasBranchAccess } from '@/lib/auth/authorization'
import { uploadToR2, getR2SignedDownloadUrl } from '@/lib/storage/r2'

const R2_BUCKET = process.env.R2_BUCKET_NAME ?? ''
const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const metadataSchema = z.object({
  branchId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  caption: z.string().max(500).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)))
    .limit(1)
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rows = await db
    .select({
      id: clientVisitPhotos.id,
      caption: clientVisitPhotos.caption,
      createdAt: clientVisitPhotos.createdAt,
      appointmentId: clientVisitPhotos.appointmentId,
      branchName: branches.name,
      storagePath: files.storagePath,
    })
    .from(clientVisitPhotos)
    .innerJoin(files, eq(files.id, clientVisitPhotos.fileId))
    .innerJoin(branches, eq(branches.id, clientVisitPhotos.branchId))
    .where(and(eq(clientVisitPhotos.organizationId, user.organizationId), eq(clientVisitPhotos.clientId, id)))
    .orderBy(desc(clientVisitPhotos.createdAt))
    .limit(100)

  const result = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      caption: r.caption,
      createdAt: r.createdAt,
      appointmentId: r.appointmentId,
      branchName: r.branchName,
      imageUrl: await getR2SignedDownloadUrl(r.storagePath, 300),
    })),
  )

  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)))
    .limit(1)
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file')
  const parsed = metadataSchema.safeParse({
    branchId: formData.get('branchId'),
    appointmentId: formData.get('appointmentId') || undefined,
    caption: formData.get('caption') || undefined,
  })
  if (!(file instanceof File) || !parsed.success) {
    return NextResponse.json({ error: 'Archivo o metadata inválida' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE || !ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Tipo o tamaño de archivo no permitido' }, { status: 400 })
  }
  if (!hasBranchAccess(user, parsed.data.branchId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, parsed.data.branchId), eq(branches.organizationId, user.organizationId)))
    .limit(1)
  if (!branch) return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })

  if (parsed.data.appointmentId) {
    const [appointment] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, parsed.data.appointmentId),
          eq(appointments.organizationId, user.organizationId),
          eq(appointments.clientId, id),
        ),
      )
      .limit(1)
    if (!appointment) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.organizationId}/client-photos/${id}/${crypto.randomUUID()}-${safeName}`
  await uploadToR2(storagePath, Buffer.from(await file.arrayBuffer()), file.type)

  const [record] = await db.transaction(async (tx) => {
    const [fileRow] = await tx
      .insert(files)
      .values({
        organizationId: user.organizationId,
        entityType: 'client',
        entityId: id,
        fileCategory: 'client_photo',
        visibility: 'client_visible',
        storageProvider: 'r2',
        storageBucket: R2_BUCKET,
        storagePath,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: user.id,
      })
      .returning()

    const [photoRow] = await tx
      .insert(clientVisitPhotos)
      .values({
        organizationId: user.organizationId,
        clientId: id,
        branchId: parsed.data.branchId,
        appointmentId: parsed.data.appointmentId ?? null,
        fileId: fileRow.id,
        caption: parsed.data.caption ?? null,
        createdByUserId: user.id,
      })
      .returning()

    return [photoRow]
  })

  return NextResponse.json(record, { status: 201 })
}
