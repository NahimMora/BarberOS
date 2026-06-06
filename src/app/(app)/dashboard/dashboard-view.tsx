import Link from 'next/link'
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Scissors,
  Store,
  Users,
  WalletCards,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AppUser } from '@/lib/auth/get-session'
import type { DashboardData } from '@/lib/dashboard/get-dashboard-data'
import { formatArs } from '@/lib/money/display'
import { cn } from '@/lib/utils'

const roleCopy = {
  admin: {
    eyebrow: 'Control general',
    description: 'Ventas, turnos, cajas y comisiones de toda la operación.',
  },
  receptionist: {
    eyebrow: 'Frente de atención',
    description: 'Agenda, cobros y estado de caja de tus sucursales.',
  },
  barber: {
    eyebrow: 'Jornada personal',
    description: 'Tu agenda de hoy y el resultado acumulado del mes.',
  },
}

const appointmentLabels = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'En atención',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'Ausente',
}

const quickActions = [
  {
    href: '/agenda',
    label: 'Abrir agenda',
    detail: 'Turnos y disponibilidad',
    icon: CalendarDays,
    roles: ['admin', 'receptionist', 'barber'],
  },
  {
    href: '/clientes',
    label: 'Buscar cliente',
    detail: 'Ficha y preferencias',
    icon: Users,
    roles: ['admin', 'receptionist', 'barber'],
  },
  {
    href: '/caja',
    label: 'Operar caja',
    detail: 'Cobros y cierre',
    icon: CircleDollarSign,
    roles: ['admin', 'receptionist'],
  },
  {
    href: '/comisiones',
    label: 'Ver comisiones',
    detail: 'Importes del período',
    icon: WalletCards,
    roles: ['admin', 'barber'],
  },
]

export function DashboardView({
  user,
  data,
}: {
  user: AppUser
  data: DashboardData
}) {
  const firstName = user.fullName.split(' ')[0]
  const copy = roleCopy[user.role]
  const dayLabel = formatDateLabel(data.calendarDate)
  const monthLabel = formatMonthLabel(data.calendarMonth)
  const actions = quickActions.filter((action) => action.roles.includes(user.role))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={`Buen día, ${firstName}.`}
        description={`${copy.description} Datos al ${dayLabel}.`}
        actions={(
          <Link href="/agenda" className={buttonVariants({ size: 'lg' })}>
            <CalendarDays data-icon="inline-start" />
            Ver agenda
          </Link>
        )}
      />

      {user.role === 'barber' && data.barberMetrics
        ? <BarberMetrics data={data} monthLabel={monthLabel} />
        : <OperationMetrics data={data} monthLabel={monthLabel} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)]">
        <TodayAgenda data={data} />
        <QuickActions actions={actions} />
      </div>

      {user.role !== 'barber' ? <BranchOverview data={data} /> : null}
    </div>
  )
}

function OperationMetrics({
  data,
  monthLabel,
}: {
  data: DashboardData
  monthLabel: string
}) {
  return (
    <section className="paper-surface overflow-hidden rounded-3xl border border-border/70 shadow-sm">
      <div className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <Metric
          label="Facturación de hoy"
          value={formatArs(data.summary.todayRevenue)}
          note={`${data.summary.todaySales} ventas pagadas`}
          icon={CircleDollarSign}
          emphasis
        />
        <Metric
          label={`Facturación · ${monthLabel}`}
          value={formatArs(data.summary.monthRevenue)}
          note="Total neto cobrado"
          icon={WalletCards}
        />
        <Metric
          label="Turnos de hoy"
          value={String(data.summary.todayAppointments)}
          note="Sin cancelados"
          icon={CalendarDays}
        />
        {data.role === 'admin' ? (
          <Metric
            label="Comisiones pendientes"
            value={formatArs(data.summary.pendingCommissions)}
            note={`${data.summary.openCashSessions} cajas abiertas`}
            icon={Scissors}
          />
        ) : (
          <Metric
            label="Cajas abiertas"
            value={String(data.summary.openCashSessions)}
            note={`${data.branches.length} sucursales asignadas`}
            icon={Store}
          />
        )}
      </div>
    </section>
  )
}

function BarberMetrics({
  data,
  monthLabel,
}: {
  data: DashboardData
  monthLabel: string
}) {
  const metrics = data.barberMetrics
  if (!metrics) return null

  return (
    <section className="paper-surface overflow-hidden rounded-3xl border border-border/70 shadow-sm">
      <div className="border-b border-border/70 px-6 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Resultado · {monthLabel}
        </p>
      </div>
      <div className="grid divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric
          label="Cortes completados"
          value={String(metrics.completedCuts)}
          note={`${data.summary.todayAppointments} turnos para hoy`}
          icon={CheckCircle2}
          emphasis
        />
        <Metric
          label="Ingresos generados"
          value={formatArs(metrics.generatedRevenue)}
          note="Ventas pagadas del mes"
          icon={CircleDollarSign}
        />
        <Metric
          label="Comisión devengada"
          value={formatArs(metrics.accruedCommission)}
          note="Según tasa guardada en cada venta"
          icon={WalletCards}
        />
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
  emphasis = false,
}: {
  label: string
  value: string
  note: string
  icon: typeof CircleDollarSign
  emphasis?: boolean
}) {
  return (
    <div className={cn('relative min-h-40 p-6', emphasis && 'bg-primary text-primary-foreground')}>
      <div className="mb-8 flex items-center justify-between gap-3">
        <p className={cn(
          'text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground',
          emphasis && 'text-primary-foreground/70',
        )}>
          {label}
        </p>
        <Icon className={cn('size-4 text-primary', emphasis && 'text-primary-foreground')} aria-hidden="true" />
      </div>
      <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className={cn(
        'mt-2 text-xs text-muted-foreground',
        emphasis && 'text-primary-foreground/70',
      )}>
        {note}
      </p>
    </div>
  )
}

function TodayAgenda({ data }: { data: DashboardData }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Agenda de hoy</CardTitle>
        <CardDescription>
          {data.role === 'barber' ? 'Tus próximas atenciones.' : 'Actividad de las sucursales visibles.'}
        </CardDescription>
        <CardAction>
          <Link href="/agenda" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Ver completa
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {data.agenda.length === 0 ? (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
              <EmptyTitle>No hay turnos para hoy</EmptyTitle>
              <EmptyDescription>
                La jornada está libre. Podés crear un turno desde la agenda.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    {data.role !== 'barber' ? <TableHead>Barbero</TableHead> : null}
                    <TableHead>Sucursal</TableHead>
                    <TableHead className="pr-4 text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agenda.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-4 font-mono font-semibold tabular-nums">
                        {formatTime(item.startAt, data.timeZone)}
                      </TableCell>
                      <TableCell className="font-semibold">{item.clientName}</TableCell>
                      {data.role !== 'barber' ? <TableCell>{item.barberName}</TableCell> : null}
                      <TableCell>{item.branchName}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <AppointmentBadge status={item.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="divide-y divide-border/70 md:hidden">
              {data.agenda.map((item) => (
                <div key={item.id} className="flex gap-4 px-4 py-4">
                  <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary font-mono text-sm font-bold">
                    {formatTime(item.startAt, data.timeZone)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold">{item.clientName}</p>
                      <AppointmentBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.role === 'barber'
                        ? item.branchName
                        : `${item.barberName} · ${item.branchName}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function QuickActions({
  actions,
}: {
  actions: Array<(typeof quickActions)[number]>
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Resolver ahora</CardTitle>
        <CardDescription>Accesos directos al trabajo diario.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex min-h-16 items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <action.icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{action.label}</span>
              <span className="block text-xs text-muted-foreground">{action.detail}</span>
            </span>
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function BranchOverview({ data }: { data: DashboardData }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Sucursales</p>
        <h2 className="mt-1 font-heading text-2xl font-semibold">Pulso operativo</h2>
      </div>
      {data.branches.length === 0 ? (
        <Card>
          <Empty className="min-h-44">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Store /></EmptyMedia>
              <EmptyTitle>No hay sucursales disponibles</EmptyTitle>
              <EmptyDescription>Revisá la asignación de sucursales del usuario.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {data.branches.map((branch) => (
            <Card key={branch.id}>
              <CardHeader>
                <CardTitle className="text-xl">{branch.name}</CardTitle>
                <CardDescription>
                  {branch.todayAppointments} turnos · {branch.todaySales} ventas hoy
                </CardDescription>
                <CardAction>
                  <Badge
                    variant={branch.cashStatus === 'open' ? 'default' : 'outline'}
                    className={branch.cashStatus === 'open' ? 'bg-success text-success-foreground' : undefined}
                  >
                    {branch.cashStatus === 'open' ? 'Caja abierta' : 'Caja cerrada'}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/65 p-3">
                  <p className="text-xs text-muted-foreground">Hoy</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {formatArs(branch.todayRevenue)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/65 p-3">
                  <p className="text-xs text-muted-foreground">Mes</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {formatArs(branch.monthRevenue)}
                  </p>
                </div>
                {branch.cashOpenedAt ? (
                  <p className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    Abierta desde las {formatTime(branch.cashOpenedAt, data.timeZone)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

function AppointmentBadge({
  status,
}: {
  status: DashboardData['agenda'][number]['status']
}) {
  const variant = status === 'completed'
    ? 'secondary'
    : status === 'no_show'
      ? 'destructive'
      : status === 'in_progress'
        ? 'default'
        : 'outline'

  return <Badge variant={variant}>{appointmentLabels[status]}</Badge>
}

function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00.000Z`))
}

function formatMonthLabel(month: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T12:00:00.000Z`))
}

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
