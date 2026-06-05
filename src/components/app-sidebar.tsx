import Link from 'next/link'
import { CalendarDays, Users, DollarSign, BarChart2, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'receptionist' | 'barber'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: Home, roles: ['admin', 'receptionist', 'barber'] as Role[] },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays, roles: ['admin', 'receptionist', 'barber'] as Role[], disabled: true },
  { href: '/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'receptionist', 'barber'] as Role[], disabled: true },
  { href: '/caja', label: 'Caja', icon: DollarSign, roles: ['admin', 'receptionist'] as Role[], disabled: true },
  { href: '/comisiones', label: 'Comisiones', icon: BarChart2, roles: ['admin'] as Role[], disabled: true },
]

export function AppSidebar({ role }: { role: Role }) {
  const visible = navItems.filter((item) => item.roles.includes(role))

  return (
    <aside className="hidden md:flex w-56 flex-col border-r bg-card px-3 py-4 shrink-0">
      <div className="mb-6 px-2">
        <span className="text-lg font-bold">BarberOS</span>
      </div>
      <nav className="flex flex-col gap-1">
        {visible.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.disabled ? '#' : item.href}
              aria-disabled={item.disabled}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                item.disabled
                  ? 'pointer-events-none text-muted-foreground/50'
                  : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
