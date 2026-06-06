import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { AppSidebar, MobileNavigation } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) redirect('/login')
  if (session.status === 'disabled') redirect('/login')

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar role={session.role} />
      <div className="min-w-0 flex-1">
        <AppHeader user={session} />
        <main className="app-canvas min-h-[calc(100dvh-4rem)] px-4 pb-28 pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-8">
          <div className="page-enter mx-auto w-full max-w-[96rem]">
            {children}
          </div>
        </main>
      </div>
      <MobileNavigation role={session.role} />
    </div>
  )
}
