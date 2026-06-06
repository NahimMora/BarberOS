import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { ControlCenter } from './control-center'

export default async function ControlPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/dashboard')

  return <ControlCenter />
}
