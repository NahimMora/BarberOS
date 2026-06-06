import { redirect } from 'next/navigation'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { branches } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { db } from '@/lib/db'
import { ExportCenter } from './export-center'

export default async function ExportacionesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'barber') redirect('/dashboard')

  const conditions = [
    eq(branches.organizationId, session.organizationId),
    eq(branches.active, true),
    isNull(branches.deletedAt),
  ]
  if (session.role === 'receptionist') {
    if (session.branchIds.length === 0) {
      return <ExportCenter role={session.role} branches={[]} />
    }
    conditions.push(inArray(branches.id, session.branchIds))
  }

  const branchRows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(...conditions))
    .orderBy(asc(branches.name))

  return <ExportCenter role={session.role} branches={branchRows} />
}
