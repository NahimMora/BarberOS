import { NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientVisitPhotos, files, branches } from '@/db/schema'
import { getClientSession } from '@/lib/auth/get-client-session'
import { getR2SignedDownloadUrl } from '@/lib/storage/r2'

export async function GET(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id: clientVisitPhotos.id,
      caption: clientVisitPhotos.caption,
      createdAt: clientVisitPhotos.createdAt,
      appointmentId: clientVisitPhotos.appointmentId,
      branchName: branches.name,
      fileId: files.id,
      storagePath: files.storagePath,
    })
    .from(clientVisitPhotos)
    .innerJoin(files, eq(files.id, clientVisitPhotos.fileId))
    .innerJoin(branches, eq(branches.id, clientVisitPhotos.branchId))
    .where(
      and(
        eq(clientVisitPhotos.organizationId, client.organizationId),
        eq(clientVisitPhotos.clientId, client.id),
      ),
    )
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
