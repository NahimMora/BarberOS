import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { branches } from '@/db/schema'
import { getClientSession } from '@/lib/auth/get-client-session'

export async function GET(req: Request) {
  const client = await getClientSession(req)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id: branches.id,
      name: branches.name,
      address: branches.address,
      timezone: branches.timezone,
      workingHours: branches.workingHours,
    })
    .from(branches)
    .where(
      and(
        eq(branches.organizationId, client.organizationId),
        eq(branches.active, true),
        isNull(branches.deletedAt),
      ),
    )
    .orderBy(branches.name)

  return NextResponse.json(rows)
}
