import Link from 'next/link'
import {
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Scissors,
  Settings2,
  Users,
} from 'lucide-react'
import { getSession } from '@/lib/auth/get-session'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const roleCopy = {
  admin: {
    eyebrow: 'Control general',
    description: 'Organizá la operación y mantené cada sucursal lista para trabajar.',
  },
  receptionist: {
    eyebrow: 'Frente de atención',
    description: 'Coordiná agenda, clientes y cobros de tu sucursal desde un solo lugar.',
  },
  barber: {
    eyebrow: 'Jornada personal',
    description: 'Consultá tu agenda y avanzá cada atención con el estado correcto.',
  },
}

const actions = [
  {
    href: '/agenda',
    title: 'Abrir agenda',
    description: 'Ver turnos, disponibilidad y próximos pasos.',
    icon: CalendarDays,
    roles: ['admin', 'receptionist', 'barber'],
  },
  {
    href: '/clientes',
    title: 'Buscar cliente',
    description: 'Consultar datos o registrar una nueva visita.',
    icon: Users,
    roles: ['admin', 'receptionist', 'barber'],
  },
  {
    href: '/operacion',
    title: 'Configurar operación',
    description: 'Administrar sucursales, equipo y servicios.',
    icon: Settings2,
    roles: ['admin'],
  },
  {
    href: '/caja',
    title: 'Operar caja',
    description: 'Cobrar ventas, registrar movimientos y cerrar la jornada.',
    icon: CircleDollarSign,
    roles: ['admin', 'receptionist'],
  },
  {
    href: '/comisiones',
    title: 'Ver comisiones',
    description: 'Consultar importes por período y liquidar pendientes.',
    icon: CircleDollarSign,
    roles: ['admin', 'barber'],
  },
]

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null

  const firstName = session.fullName.split(' ')[0]
  const copy = roleCopy[session.role]
  const visibleActions = actions.filter((action) => action.roles.includes(session.role))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={`Buen día, ${firstName}.`}
        description={copy.description}
      />

      <section className="paper-surface relative overflow-hidden rounded-3xl border border-border/70 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-accent/35 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="flex max-w-2xl flex-col gap-4">
            <Badge className="w-fit" variant="secondary">Centro operativo</Badge>
            <h2 className="font-heading text-3xl font-semibold leading-tight text-balance sm:text-4xl">
              Todo empieza con una agenda ordenada.
            </h2>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              BarberOS prioriza el flujo diario: recibir, atender, cobrar y dejar cada
              movimiento preparado para el cierre.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-card/70 p-3 backdrop-blur">
            {[
              { label: 'Agendar', icon: CalendarDays },
              { label: 'Cobrar', icon: CircleDollarSign },
              { label: 'Atender', icon: Scissors },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2 rounded-xl px-2 py-4 text-center">
                <item.icon className="size-5 text-primary" aria-hidden="true" />
                <span className="text-xs font-bold">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Accesos rápidos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Continuá con la tarea que necesitás resolver ahora.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleActions.map((action) => (
            <Link key={action.href} href={action.href} className="group">
              <Card className="h-full transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-md">
                <CardHeader>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <action.icon className="size-5" aria-hidden="true" />
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                  <CardDescription className="leading-5">{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Abrir módulo
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
