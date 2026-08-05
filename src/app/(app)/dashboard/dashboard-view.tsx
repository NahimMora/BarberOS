import Link from 'next/link'
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Scissors,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserX,
  WalletCards,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RevenueTrendChart } from '@/components/dashboard/revenue-trend-chart'
import { WeekdayOccupancyChart } from '@/components/dashboard/weekday-occupancy-chart'
import type { AppUser } from '@/lib/auth/get-session'
import type { DashboardData } from '@/lib/dashboard/get-dashboard-data'
import { formatArs } from '@/lib/money/display'
import { cn } from '@/lib/utils'

const roleCopy = {
  admin: {
    eyebrow: 'Control general',
    description: 'Tendencias y proyecciones de toda la organización.',
  },
  receptionist: {
    eyebrow: 'Frente de atención',
    description: 'Tendencias y proyecciones de tus sucursales.',
  },
  barber: {
    eyebrow: 'Jornada personal',
    description: 'Tu tendencia del mes y el resultado acumulado.',
  },
}

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
  const hasRankings = data.stats.topBarbers.length > 0 || data.stats.topServices.length > 0

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
        : <TodayStrip data={data} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <TrendCard data={data} monthLabel={monthLabel} />
        <OccupancyCard data={data} />
      </div>

      {hasRankings ? <RankingsCard data={data} monthLabel={monthLabel} /> : null}
    </div>
  )
}

function TodayStrip({ data }: { data: DashboardData }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border">
      <div className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Metric
          label="Facturación de hoy"
          value={formatArs(data.summary.todayRevenue)}
          note={`${data.summary.todaySales} ventas pagadas`}
          icon={CircleDollarSign}
          emphasis
        />
        <Metric
          label="Turnos de hoy"
          value={String(data.summary.todayAppointments)}
          note={data.role === 'admin'
            ? `${data.summary.openCashSessions} cajas abiertas`
            : `${data.branches.length} sucursales asignadas`}
          icon={CalendarDays}
        />
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
    <section className="overflow-hidden rounded-3xl border border-border">
      <div className="border-b border-border/70 px-6 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
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
          'text-xs font-bold uppercase tracking-wide text-muted-foreground',
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

function TrendCard({ data, monthLabel }: { data: DashboardData; monthLabel: string }) {
  const { monthProjection } = data.stats
  const variance = monthProjection.varianceVsPreviousMonth
  const isUp = variance !== null && variance >= 0

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Tendencia de facturación</CardTitle>
        <CardDescription>Últimos 30 días · proyección estadística, no es un monto garantizado.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Proyección · {monthLabel}
            </p>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {formatArs(monthProjection.projected)}
            </p>
          </div>
          {variance !== null ? (
            <Badge variant={isUp ? 'success' : 'destructive'} className="gap-1">
              {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(variance).toFixed(0)}% vs mes anterior
            </Badge>
          ) : null}
        </div>
        <RevenueTrendChart data={data.stats.revenueTrend} />
      </CardContent>
    </Card>
  )
}

function OccupancyCard({ data }: { data: DashboardData }) {
  const { noShowRate } = data.stats

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Ocupación de agenda</CardTitle>
        <CardDescription>Promedio de turnos por día, últimas 8 semanas.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-6">
        <WeekdayOccupancyChart data={data.stats.appointmentsByWeekday} />
        <div className="flex items-center gap-2 rounded-xl bg-muted/65 p-3">
          <UserX className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Ausentismo (no-show): <span className="font-mono font-semibold tabular-nums text-foreground">{noShowRate.toFixed(0)}%</span>
            {' '}de los turnos, últimos 30 días.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function RankingsCard({ data, monthLabel }: { data: DashboardData; monthLabel: string }) {
  const { topBarbers, topServices } = data.stats

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Rankings · {monthLabel}</CardTitle>
        <CardDescription>Quién y qué generó más ingresos este mes.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6 lg:grid-cols-2">
        {topBarbers.length > 0 ? (
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Trophy className="size-3.5" aria-hidden="true" />
              Barberos
            </p>
            <ul className="flex flex-col gap-2">
              {topBarbers.map((barber, index) => (
                <li key={barber.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                    <span className="truncate text-sm font-semibold">{barber.name}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm font-semibold tabular-nums">{formatArs(barber.revenue)}</span>
                    <span className="block text-xs text-muted-foreground">{barber.completedCuts} cortes</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {topServices.length > 0 ? (
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Scissors className="size-3.5" aria-hidden="true" />
              Servicios
            </p>
            <ul className="flex flex-col gap-2">
              {topServices.map((service, index) => (
                <li key={service.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                    <span className="truncate text-sm font-semibold">{service.name}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm font-semibold tabular-nums">{formatArs(service.revenue)}</span>
                    <span className="block text-xs text-muted-foreground">{service.count} vendidos</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
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
