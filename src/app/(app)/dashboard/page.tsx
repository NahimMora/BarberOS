import { getSession } from '@/lib/auth/get-session'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { DashboardView } from './dashboard-view'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null

  const data = await getDashboardData(session)
  return <DashboardView user={session} data={data} />
}
