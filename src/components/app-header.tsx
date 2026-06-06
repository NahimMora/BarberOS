'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import type { AppUser } from '@/lib/auth/get-session'

const roleLabel: Record<AppUser['role'], string> = {
  admin: 'Admin',
  receptionist: 'Recepcionista',
  barber: 'Barbero',
}

export function AppHeader({ user }: { user: AppUser }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = user.fullName
    .split(' ')
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase()
  const today = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-background/88 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-4">
        <BrandMark compact className="md:hidden" />
        <div className="hidden flex-col sm:flex">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {roleLabel[user.role]}
          </span>
          <span className="text-sm font-semibold capitalize">{today}</span>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-h-10 items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-3 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-semibold sm:block">{user.fullName}</span>
          <Badge variant="secondary" className="hidden lg:inline-flex">{roleLabel[user.role]}</Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut data-icon="inline-start" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
