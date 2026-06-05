import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) redirect('/login')
  if (session.status === 'disabled') redirect('/login')

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar role={session.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader user={session} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
