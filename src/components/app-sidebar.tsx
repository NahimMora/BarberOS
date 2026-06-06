'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  ChartNoAxesCombined,
  DollarSign,
  House,
  Settings2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'receptionist' | 'barber'

const navItems: {
  href: string
  label: string
  icon: LucideIcon
  roles: Role[]
  disabled?: boolean
  mobile?: boolean
}[] = [
  { href: '/dashboard', label: 'Inicio', icon: House, roles: ['admin', 'receptionist', 'barber'] as Role[] },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays, roles: ['admin', 'receptionist', 'barber'] as Role[] },
  { href: '/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'receptionist', 'barber'] as Role[] },
  { href: '/operacion', label: 'Operación', icon: Settings2, roles: ['admin'] as Role[], mobile: false },
  { href: '/caja', label: 'Caja', icon: DollarSign, roles: ['admin', 'receptionist'] as Role[] },
  { href: '/comisiones', label: 'Comisiones', icon: ChartNoAxesCombined, roles: ['admin', 'barber'] as Role[] },
]

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const visible = navItems.filter((item) => item.roles.includes(role))

  return (
    <aside className="hidden h-dvh w-62 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground md:sticky md:top-0 md:flex">
      <div className="mb-8 px-2">
        <BrandMark />
      </div>
      <p className="mb-2 px-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/45">
        Espacio de trabajo
      </p>
      <nav className="flex flex-col gap-1.5">
        {visible.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.disabled ? '#' : item.href}
              aria-disabled={item.disabled}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                item.disabled
                  ? 'pointer-events-none text-sidebar-foreground/25'
                  : active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
              {item.disabled ? (
                <span className="ml-auto text-[0.58rem] font-bold uppercase tracking-wider">Pronto</span>
              ) : null}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
        <p className="text-xs font-semibold">Operación protegida</p>
        <p className="mt-1 text-[0.68rem] leading-4 text-sidebar-foreground/55">
          Roles y sucursales se validan también en el servidor.
        </p>
      </div>
    </aside>
  )
}

export function MobileNavigation({ role }: { role: Role }) {
  const pathname = usePathname()
  const visible = navItems.filter(
    (item) => item.roles.includes(role) && !item.disabled && item.mobile !== false,
  )

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 flex min-h-16 items-stretch justify-around rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-xl backdrop-blur-xl md:hidden">
      {visible.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[0.65rem] font-bold transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
