import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { CashConsole } from './cash-console'

export default async function CajaPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'barber') redirect('/dashboard')

  return <CashConsole />
}
