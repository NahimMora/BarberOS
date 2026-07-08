'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  Banknote,
  Braces,
  Download,
  FileClock,
  FileSpreadsheet,
  ReceiptText,
  Scissors,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getCommissionPeriod } from '@/lib/finance/commission-period'

type Role = 'admin' | 'receptionist'
type Branch = { id: string; name: string }

type PeriodSupport = 'range' | 'monthOnly' | 'none'

const reports: {
  resource: string
  title: string
  description: string
  icon: typeof ReceiptText
  roles: Role[]
  period: PeriodSupport
  branch: boolean
}[] = [
  {
    resource: 'sales',
    title: 'Ventas',
    description: 'Ventas pagadas, descuentos, método, cliente y barbero.',
    icon: ReceiptText,
    roles: ['admin', 'receptionist'],
    period: 'range',
    branch: true,
  },
  {
    resource: 'cash',
    title: 'Caja',
    description: 'Sesiones, totales por método, efectivo contado y diferencia.',
    icon: Banknote,
    roles: ['admin', 'receptionist'],
    period: 'range',
    branch: true,
  },
  {
    resource: 'clients',
    title: 'Clientes',
    description: 'Datos de contacto, consentimientos y preferencias vigentes. Siempre exporta el listado completo, sin período.',
    icon: Users,
    roles: ['admin', 'receptionist'],
    period: 'none',
    branch: false,
  },
  {
    resource: 'commissions',
    title: 'Comisiones',
    description: 'Base neta, tasa congelada, importe y estado por venta. Solo por mes calendario completo (así se liquida).',
    icon: Scissors,
    roles: ['admin'],
    period: 'monthOnly',
    branch: true,
  },
  {
    resource: 'audit',
    title: 'Auditoría',
    description: 'Acciones sensibles, actor, entidad y detalle del cambio.',
    icon: FileClock,
    roles: ['admin'],
    period: 'range',
    branch: false,
  },
  {
    resource: 'domain-events',
    title: 'Eventos de negocio',
    description: 'Hechos operativos registrados por la aplicación.',
    icon: Activity,
    roles: ['admin'],
    period: 'range',
    branch: false,
  },
  {
    resource: 'system-events',
    title: 'Eventos técnicos',
    description: 'Señales, advertencias y errores internos de la organización.',
    icon: Braces,
    roles: ['admin'],
    period: 'range',
    branch: false,
  },
]

type Preset = 'today' | 'week' | 'month' | 'lastMonth' | 'custom'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'lastMonth', label: 'Mes anterior' },
  { value: 'custom', label: 'Rango personalizado' },
]

const TIMEZONE = 'America/Argentina/Buenos_Aires'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfWeek(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(date)
  monday.setDate(date.getDate() - diff)
  return monday
}

function previousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  return `${previous.year}-${pad(previous.month)}`
}

/** Resolves a preset into the query params the export endpoint understands, plus a human label. */
function resolvePreset(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date()
  const currentPeriod = getCommissionPeriod(now, TIMEZONE)

  switch (preset) {
    case 'today': {
      const today = toDateInputValue(now)
      return { from: today, to: today, label: today }
    }
    case 'week': {
      const from = toDateInputValue(startOfWeek(now))
      const to = toDateInputValue(now)
      return { from, to, label: `${from} a ${to}` }
    }
    case 'month':
      return { period: currentPeriod, label: currentPeriod }
    case 'lastMonth': {
      const period = previousPeriod(currentPeriod)
      return { period, label: period }
    }
    case 'custom':
      return customFrom && customTo
        ? { from: customFrom, to: customTo, label: `${customFrom} a ${customTo}` }
        : { label: 'Elegí un rango' }
  }
}

async function downloadExport(url: string, fallbackFilename: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      toast.error(typeof body?.error === 'string' ? body.error : 'No se pudo generar la exportación')
      return
    }
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackFilename
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    toast.error('No se pudo generar la exportación')
  }
}

export function ExportCenter({
  role,
  branches,
}: {
  role: Role
  branches: Branch[]
}) {
  const [preset, setPreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [branchId, setBranchId] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const resolved = useMemo(
    () => resolvePreset(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  )
  const isDayRange = 'from' in resolved && Boolean(resolved.from)
  const rangeIncomplete = preset === 'custom' && !isDayRange

  const visibleReports = useMemo(
    () => reports.filter((report) => report.roles.some((allowed) => allowed === role)),
    [role],
  )

  async function handleDownload(
    report: (typeof reports)[number],
    format: 'csv' | 'xls',
  ) {
    const query = new URLSearchParams()
    if (report.period !== 'none') {
      if ('period' in resolved && resolved.period) query.set('period', resolved.period)
      if ('from' in resolved && resolved.from) query.set('from', resolved.from)
      if ('to' in resolved && resolved.to) query.set('to', resolved.to)
    }
    if (report.branch && branchId) query.set('branch_id', branchId)
    query.set('format', format)

    const key = `${report.resource}-${format}`
    setPending(key)
    try {
      await downloadExport(
        `/api/exports/${report.resource}?${query}`,
        `${report.title.toLowerCase()}.${format === 'csv' ? 'csv' : 'xls'}`,
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Datos"
        title="Exportaciones"
        description="Descargá información operativa con el mismo alcance de sucursales y permisos que usás en BarberOS."
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">Período</CardTitle>
          <CardDescription>
            El período usa la zona horaria de la organización. Clientes siempre exporta el listado
            completo; Comisiones solo admite mes calendario completo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={preset === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreset(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {preset === 'custom' ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Desde
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="h-10 bg-card"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Hasta
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="h-10 bg-card"
                />
              </label>
            </div>
          ) : null}

          <label className="flex flex-col gap-2 text-sm font-semibold sm:max-w-md">
            Sucursal
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Todas las sucursales visibles</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleReports.map((report) => {
          const disabled = report.period === 'monthOnly' && isDayRange
          const periodBadge = report.period === 'none'
            ? 'Completo'
            : disabled
              ? 'No aplica'
              : resolved.label

          return (
            <Card key={report.resource} className="flex min-h-64 flex-col">
              <CardHeader>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <report.icon className="size-5" aria-hidden="true" />
                  </span>
                  <Badge variant={disabled ? 'outline' : 'secondary'}>{periodBadge}</Badge>
                </div>
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <CardDescription className="leading-5">{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-10"
                  disabled={disabled || rangeIncomplete || pending === `${report.resource}-csv`}
                  onClick={() => void handleDownload(report, 'csv')}
                >
                  <Download data-icon="inline-start" />
                  {pending === `${report.resource}-csv` ? 'Generando...' : 'CSV'}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="h-10"
                  disabled={disabled || rangeIncomplete || pending === `${report.resource}-xls`}
                  onClick={() => void handleDownload(report, 'xls')}
                >
                  <FileSpreadsheet data-icon="inline-start" />
                  {pending === `${report.resource}-xls` ? 'Generando...' : 'Excel'}
                </Button>
              </CardContent>
              {disabled ? (
                <p className="px-6 pb-4 text-xs text-muted-foreground">
                  Elegí &quot;Este mes&quot; o &quot;Mes anterior&quot; para exportar comisiones.
                </p>
              ) : null}
            </Card>
          )
        })}
      </section>
    </div>
  )
}
