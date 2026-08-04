'use client'

import { Info, LogOut } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { createClient } from '@/lib/supabase/client'
import type { AppUser } from '@/lib/auth/get-session'

const roleLabel: Record<AppUser['role'], string> = {
  admin: 'Admin',
  receptionist: 'Recepcionista',
  barber: 'Barbero',
}

const roleCapabilities: Record<AppUser['role'], string[]> = {
  admin: [
    'Agenda, clientes y turnos de todas las sucursales',
    'Caja: apertura, cierre y anulación de ventas',
    'Operación: equipo, servicios y disponibilidad',
    'Comisiones: liquidación por barbero',
    'Control y exportaciones',
  ],
  receptionist: [
    'Agenda, clientes y turnos',
    'Caja: apertura, cierre y cobros',
    'Exportaciones',
    'Sin acceso a operación, comisiones ni control',
  ],
  barber: [
    'Tu agenda y tus turnos',
    'Clientes',
    'Tus propias comisiones',
    'Sin acceso a caja, operación, control ni exportaciones',
  ],
}

function RoleInfoPopover({ role }: { role: AppUser['role'] }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Qué puede hacer ${roleLabel[role]}`}
            className="text-muted-foreground"
          />
        }
      >
        <Info />
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="text-xs font-bold uppercase tracking-wide text-primary/75">Tu rol</p>
        <p className="mt-1 font-heading text-base font-bold">{roleLabel[role]}</p>
        <p className="mt-1 text-xs text-muted-foreground">Qué podés hacer con este usuario:</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {roleCapabilities[role].map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-primary">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function AppHeader({ user }: { user: AppUser }) {
  async function handleLogout() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (!error) window.location.replace('/login')
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
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-background/88 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-4">
        <BrandMark compact className="md:hidden" />
        <div className="hidden flex-col sm:flex">
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {roleLabel[user.role]}
            <RoleInfoPopover role={user.role} />
          </span>
          <span className="text-sm font-semibold capitalize">{today}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
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
      </div>
    </header>
  )
}
