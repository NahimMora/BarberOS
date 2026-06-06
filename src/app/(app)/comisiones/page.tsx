import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { CommissionsReport } from './commissions-report'

export default async function ComisionesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'receptionist') redirect('/dashboard')

  return <CommissionsReport role={session.role} />
}
