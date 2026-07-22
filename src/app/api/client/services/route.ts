import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { services } from '@/db/schema'
import { getClientSession } from '@/lib/auth/get-client-session'

export async function GET(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      durationMinutes: services.durationMinutes,
      price: services.price,
    })
    .from(services)
    .where(
      and(
        eq(services.organizationId, client.organizationId),
        eq(services.active, true),
        isNull(services.deletedAt),
      ),
    )
    .orderBy(services.name)

  return NextResponse.json(rows)
}
