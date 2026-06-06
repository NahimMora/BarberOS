'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  BanknoteArrowDown,
  CalendarRange,
  CircleDollarSign,
  ReceiptText,
  Scissors,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCommissionPeriod } from '@/lib/finance/commission-period'
import { formatArs } from '@/lib/money/display'
import { formatCents, parseMoney } from '@/lib/money/money'

type Summary = {
  barberId: string
  barberName: string
  salesCount: number
  baseAmount: string
  commissionAmount: string
  pendingAmount: string
  paidAmount: string
}
type Entry = {
  id: string
  barberId: string
  barberName: string
  saleId: string
  branchId: string
  baseAmount: string
  rateSnapshot: string
  commissionAmount: string
  period: string
  status: 'pending' | 'paid' | 'cancelled'
  paidAt: string
}
type Report = {
  period: string
  summary: Summary[]
  entries: Entry[]
}

function totalsFor(summary: Summary[]) {
  return summary.reduce((totals, row) => ({
    sales: totals.sales + row.salesCount,
    base: totals.base + parseMoney(row.baseAmount),
    commissions: totals.commissions + parseMoney(row.commissionAmount),
    pending: totals.pending + parseMoney(row.pendingAmount),
  }), { sales: 0, base: 0n, commissions: 0n, pending: 0n })
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : 'No se pudo completar la operación'
}

export function CommissionsReport({ role }: { role: 'admin' | 'barber' }) {
  const [period, setPeriod] = useState(
    getCommissionPeriod(new Date(), 'America/Argentina/Buenos_Aires'),
  )
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [settlingBarberId, setSettlingBarberId] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/commissions?period=${period}`)
      if (!response.ok) throw new Error(await responseError(response))
      setReport(await response.json())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el reporte')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReport(), 0)
    return () => window.clearTimeout(timer)
  }, [loadReport])

  const totals = useMemo(() => totalsFor(report?.summary ?? []), [report])

  async function settle(barberId: string) {
    setSettlingBarberId(barberId)
    try {
      const response = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle', barberId, period }),
      })
      if (!response.ok) {
        toast.error(await responseError(response))
        return
      }
      const result = await response.json()
      toast.success(
        result.updatedCount > 0
          ? `Se liquidaron ${formatArs(result.amount)}`
          : 'No había comisiones pendientes',
      )
      await loadReport()
    } finally {
      setSettlingBarberId(null)
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Dinero"
        title="Comisiones"
        description="Cada importe conserva la tasa aplicada al momento del cobro y se calcula sobre el total neto pagado."
        actions={(
          <div className="relative">
            <CalendarRange className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Período"
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="h-11 min-w-44 bg-card pl-9"
            />
          </div>
        )}
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReportStat icon={Scissors} label="Ventas pagadas" value={String(totals.sales)} />
          <ReportStat icon={ReceiptText} label="Base neta" value={formatArs(formatCents(totals.base))} />
          <ReportStat icon={CircleDollarSign} label="Comisión total" value={formatArs(formatCents(totals.commissions))} accent />
          <ReportStat icon={BanknoteArrowDown} label="Pendiente" value={formatArs(formatCents(totals.pending))} />
        </section>
      )}

      <Card className="paper-surface">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">Período {period}</Badge>
          <CardTitle className="text-2xl">
            {role === 'admin' ? 'Liquidación por barbero' : 'Tu comisión acumulada'}
          </CardTitle>
          <CardDescription>
            Las ventas anuladas o turnos no-show no generan registros de comisión.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 px-4">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 rounded-xl" />)}
            </div>
          ) : report?.summary.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barbero</TableHead>
                      <TableHead>Ventas</TableHead>
                      <TableHead>Base neta</TableHead>
                      <TableHead>Total comisión</TableHead>
                      <TableHead>Pendiente</TableHead>
                      <TableHead className="w-36" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.summary.map((row) => (
                      <TableRow key={row.barberId}>
                        <TableCell className="font-bold">{row.barberName}</TableCell>
                        <TableCell>{row.salesCount}</TableCell>
                        <TableCell>{formatArs(row.baseAmount)}</TableCell>
                        <TableCell className="font-bold">{formatArs(row.commissionAmount)}</TableCell>
                        <TableCell>
                          <Badge variant={row.pendingAmount === '0.00' ? 'secondary' : 'outline'}>
                            {formatArs(row.pendingAmount)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {role === 'admin' && row.pendingAmount !== '0.00' ? (
                            <Button
                              size="sm"
                              disabled={settlingBarberId === row.barberId}
                              onClick={() => void settle(row.barberId)}
                            >
                              <BadgeCheck />
                              Liquidar
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 px-4 md:hidden">
                {report.summary.map((row) => (
                  <div key={row.barberId} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-heading text-xl font-semibold">{row.barberName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.salesCount} ventas pagadas</p>
                      </div>
                      <Badge variant={row.pendingAmount === '0.00' ? 'secondary' : 'outline'}>
                        {row.pendingAmount === '0.00' ? 'Liquidado' : 'Pendiente'}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Comisión</p>
                        <p className="font-bold">{formatArs(row.commissionAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">A pagar</p>
                        <p className="font-bold">{formatArs(row.pendingAmount)}</p>
                      </div>
                    </div>
                    {role === 'admin' && row.pendingAmount !== '0.00' ? (
                      <Button
                        className="mt-4 w-full"
                        disabled={settlingBarberId === row.barberId}
                        onClick={() => void settle(row.barberId)}
                      >
                        <BadgeCheck />
                        Liquidar período
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="px-4 py-14 text-center">
              <CircleDollarSign className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 font-bold">Sin comisiones en este período</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Aparecerán cuando se registren ventas pagadas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {report?.entries.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Detalle por venta</CardTitle>
            <CardDescription>Base, tasa congelada e importe generado en cada cobro.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Barbero</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Tasa</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.paidAt).toLocaleDateString('es-AR')}</TableCell>
                    <TableCell className="font-medium">{entry.barberName}</TableCell>
                    <TableCell>{formatArs(entry.baseAmount)}</TableCell>
                    <TableCell>{entry.rateSnapshot}%</TableCell>
                    <TableCell className="font-bold">{formatArs(entry.commissionAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'paid' ? 'secondary' : 'outline'}>
                        {entry.status === 'paid' ? 'Liquidada' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function ReportStat({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Scissors
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Card className={accent ? 'border-primary/30 bg-primary text-primary-foreground' : ''}>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.12em] ${accent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
            {label}
          </p>
          <p className="mt-2 font-heading text-2xl font-semibold">{value}</p>
        </div>
        <Icon className={`size-5 ${accent ? 'text-primary-foreground/70' : 'text-primary'}`} />
      </CardContent>
    </Card>
  )
}
