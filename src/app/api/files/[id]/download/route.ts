import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { files } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    requireRole(user, ['admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const [record] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, id),
        eq(files.organizationId, user.organizationId),
      ),
    )
    .limit(1)
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabaseAdmin = createSupabaseAdminClient()
  const { data, error } = await supabaseAdmin.storage
    .from(record.storageBucket)
    .createSignedUrl(record.storagePath, 60)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.redirect(data.signedUrl)
}
