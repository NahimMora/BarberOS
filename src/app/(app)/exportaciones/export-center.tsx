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
import { Input } from '@/components/ui/input'
import { getCommissionPeriod } from '@/lib/finance/commission-period'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'receptionist'
type Branch = { id: string; name: string }

const reports = [
  {
    resource: 'sales',
    title: 'Ventas',
    description: 'Ventas pagadas, descuentos, método, cliente y barbero.',
    icon: ReceiptText,
    roles: ['admin', 'receptionist'],
    period: true,
    branch: true,
  },
  {
    resource: 'cash',
    title: 'Caja',
    description: 'Sesiones, totales por método, efectivo contado y diferencia.',
    icon: Banknote,
    roles: ['admin', 'receptionist'],
    period: true,
    branch: true,
  },
  {
    resource: 'clients',
    title: 'Clientes',
    description: 'Datos de contacto, consentimientos y preferencias vigentes.',
    icon: Users,
    roles: ['admin', 'receptionist'],
    period: false,
    branch: false,
  },
  {
    resource: 'commissions',
    title: 'Comisiones',
    description: 'Base neta, tasa congelada, importe y estado por venta.',
    icon: Scissors,
    roles: ['admin'],
    period: true,
    branch: true,
  },
  {
    resource: 'audit',
    title: 'Auditoría',
    description: 'Acciones sensibles, actor, entidad y detalle del cambio.',
    icon: FileClock,
    roles: ['admin'],
    period: true,
    branch: false,
  },
  {
    resource: 'domain-events',
    title: 'Eventos de negocio',
    description: 'Hechos operativos registrados por la aplicación.',
    icon: Activity,
    roles: ['admin'],
    period: true,
    branch: false,
  },
  {
    resource: 'system-events',
    title: 'Eventos técnicos',
    description: 'Señales, advertencias y errores internos de la organización.',
    icon: Braces,
    roles: ['admin'],
    period: true,
    branch: false,
  },
] as const

export function ExportCenter({
  role,
  branches,
}: {
  role: Role
  branches: Branch[]
}) {
  const [period, setPeriod] = useState(
    getCommissionPeriod(new Date(), 'America/Argentina/Buenos_Aires'),
  )
  const [branchId, setBranchId] = useState('')
  const visibleReports = useMemo(
    () => reports.filter((report) => report.roles.some((allowed) => allowed === role)),
    [role],
  )

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Datos"
        title="Exportaciones"
        description="Descargá información operativa con el mismo alcance de sucursales y permisos que usás en BarberOS."
      />

      <Card className="paper-surface">
        <CardHeader className="border-b">
          <CardTitle className="text-xl">Contexto del reporte</CardTitle>
          <CardDescription>
            El período usa la zona horaria de la organización. Clientes se exporta completo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Período
            <Input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="h-10 bg-card"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
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
          const query = new URLSearchParams()
          if (report.period) query.set('period', period)
          if (report.branch && branchId) query.set('branch_id', branchId)
          const csvQuery = new URLSearchParams(query)
          csvQuery.set('format', 'csv')
          const xlsQuery = new URLSearchParams(query)
          xlsQuery.set('format', 'xls')

          return (
            <Card key={report.resource} className="min-h-64">
              <CardHeader>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <report.icon className="size-5" aria-hidden="true" />
                  </span>
                  <Badge variant="outline">{report.period ? period : 'Completo'}</Badge>
                </div>
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <CardDescription className="leading-5">{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto grid grid-cols-2 gap-2">
                <a
                  href={`/api/exports/${report.resource}?${csvQuery}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-10')}
                >
                  <Download data-icon="inline-start" />
                  CSV
                </a>
                <a
                  href={`/api/exports/${report.resource}?${xlsQuery}`}
                  className={cn(buttonVariants({ size: 'lg' }), 'h-10')}
                >
                  <FileSpreadsheet data-icon="inline-start" />
                  Excel
                </a>
              </CardContent>
            </Card>
          )
        })}
      </section>
    </div>
  )
}
