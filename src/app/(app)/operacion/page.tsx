import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { OperationConsole } from './operation-console'

export default async function OperationPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')

  return <OperationConsole />
}
