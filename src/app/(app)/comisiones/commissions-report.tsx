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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  branchName: string
  clientName: string | null
  services: string[]
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

function commissionStatusBadge(status: Entry['status']) {
  if (status === 'paid') return { variant: 'success' as const, label: 'Liquidada' }
  if (status === 'cancelled') return { variant: 'destructive' as const, label: 'Anulada' }
  return { variant: 'warning' as const, label: 'Pendiente' }
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
  const [settleTarget, setSettleTarget] = useState<Summary | null>(null)
  const [detailBarberFilter, setDetailBarberFilter] = useState('all')
  const [detailBranchFilter, setDetailBranchFilter] = useState('all')
  const [detailStatusFilter, setDetailStatusFilter] = useState('all')

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

  const barberOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of report?.entries ?? []) map.set(entry.barberId, entry.barberName)
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [report])
  const branchOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of report?.entries ?? []) map.set(entry.branchId, entry.branchName)
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [report])

  const filteredEntries = useMemo(() => {
    return (report?.entries ?? []).filter((entry) => {
      if (detailBarberFilter !== 'all' && entry.barberId !== detailBarberFilter) return false
      if (detailBranchFilter !== 'all' && entry.branchId !== detailBranchFilter) return false
      if (detailStatusFilter !== 'all' && entry.status !== detailStatusFilter) return false
      return true
    })
  }, [report, detailBarberFilter, detailBranchFilter, detailStatusFilter])

  const groupedEntries = useMemo(() => {
    if (role !== 'admin') return null
    const map = new Map<string, { barberName: string; entries: Entry[] }>()
    for (const entry of filteredEntries) {
      const group = map.get(entry.barberId) ?? { barberName: entry.barberName, entries: [] }
      group.entries.push(entry)
      map.set(entry.barberId, group)
    }
    return Array.from(map.values()).sort((a, b) => a.barberName.localeCompare(b.barberName))
  }, [role, filteredEntries])

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
      setSettleTarget(null)
    }
  }

  const pendingEntriesCount = settleTarget
    ? report?.entries.filter((entry) => entry.barberId === settleTarget.barberId && entry.status === 'pending').length ?? 0
    : 0

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Dinero"
        title="Comisiones"
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

      <Card>
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
                          <Badge variant={row.pendingAmount === '0.00' ? 'success' : 'warning'}>
                            {formatArs(row.pendingAmount)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {role === 'admin' && row.pendingAmount !== '0.00' ? (
                            <Button
                              size="sm"
                              disabled={settlingBarberId === row.barberId}
                              onClick={() => setSettleTarget(row)}
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
                      <Badge variant={row.pendingAmount === '0.00' ? 'success' : 'warning'}>
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
                        onClick={() => setSettleTarget(row)}
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
            <CardDescription>
              Servicio, cliente y sucursal de cada cobro — la base y la tasa quedan congeladas al momento del pago.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0">
            <div className="flex flex-wrap gap-2 px-4">
              {role === 'admin' ? (
                <FilterSelect
                  label="Barbero"
                  value={detailBarberFilter}
                  onChange={setDetailBarberFilter}
                  items={[{ value: 'all', label: 'Todos los barberos' }, ...barberOptions]}
                />
              ) : null}
              <FilterSelect
                label="Sucursal"
                value={detailBranchFilter}
                onChange={setDetailBranchFilter}
                items={[{ value: 'all', label: 'Todas las sucursales' }, ...branchOptions]}
              />
              <FilterSelect
                label="Estado"
                value={detailStatusFilter}
                onChange={setDetailStatusFilter}
                items={[
                  { value: 'all', label: 'Todos los estados' },
                  { value: 'pending', label: 'Pendiente' },
                  { value: 'paid', label: 'Liquidada' },
                ]}
              />
            </div>

            {filteredEntries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin resultados para este filtro.</p>
            ) : role === 'admin' ? (
              <div className="flex flex-col gap-5">
                {groupedEntries?.map((group) => (
                  <div key={group.barberName} className="overflow-x-auto px-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {group.barberName} · {group.entries.length} venta{group.entries.length === 1 ? '' : 's'}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha y hora</TableHead>
                          <TableHead>Servicio</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Sucursal</TableHead>
                          <TableHead>Base</TableHead>
                          <TableHead>Tasa</TableHead>
                          <TableHead>Comisión</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-mono text-sm tabular-nums whitespace-nowrap">
                              {new Date(entry.paidAt).toLocaleDateString('es-AR')}
                              {' · '}
                              {new Date(entry.paidAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell className="max-w-48 truncate" title={entry.services.join(', ')}>
                              {entry.services.length > 0 ? entry.services.join(', ') : '—'}
                            </TableCell>
                            <TableCell>{entry.clientName ?? 'Walk-in'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{entry.branchName}</TableCell>
                            <TableCell>{formatArs(entry.baseAmount)}</TableCell>
                            <TableCell>{entry.rateSnapshot}%</TableCell>
                            <TableCell className="font-bold">{formatArs(entry.commissionAmount)}</TableCell>
                            <TableCell>
                              <Badge variant={commissionStatusBadge(entry.status).variant}>
                                {commissionStatusBadge(entry.status).label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto px-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha y hora</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Tasa</TableHead>
                      <TableHead>Comisión</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-sm tabular-nums whitespace-nowrap">
                          {new Date(entry.paidAt).toLocaleDateString('es-AR')}
                          {' · '}
                          {new Date(entry.paidAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="max-w-48 truncate" title={entry.services.join(', ')}>
                          {entry.services.length > 0 ? entry.services.join(', ') : '—'}
                        </TableCell>
                        <TableCell>{entry.clientName ?? 'Walk-in'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.branchName}</TableCell>
                        <TableCell>{formatArs(entry.baseAmount)}</TableCell>
                        <TableCell>{entry.rateSnapshot}%</TableCell>
                        <TableCell className="font-bold">{formatArs(entry.commissionAmount)}</TableCell>
                        <TableCell>
                          <Badge variant={commissionStatusBadge(entry.status).variant}>
                            {commissionStatusBadge(entry.status).label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(settleTarget)} onOpenChange={(open) => !open && setSettleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar liquidación</DialogTitle>
            <DialogDescription>
              Esta acción marca como pagadas todas las comisiones pendientes del período. No se puede deshacer desde acá.
            </DialogDescription>
          </DialogHeader>
          {settleTarget ? (
            <div className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Barbero</span>
                <span className="font-semibold">{settleTarget.barberName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Período</span>
                <span className="font-semibold">{period}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Comisiones afectadas</span>
                <span className="font-semibold">{pendingEntriesCount}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">Monto total a liquidar</span>
                <span className="font-mono font-bold tabular-nums">{formatArs(settleTarget.pendingAmount)}</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleTarget(null)}>Cancelar</Button>
            <Button
              disabled={!settleTarget || settlingBarberId === settleTarget.barberId}
              onClick={() => settleTarget && void settle(settleTarget.barberId)}
            >
              <BadgeCheck />
              {settleTarget && settlingBarberId === settleTarget.barberId ? 'Liquidando...' : 'Confirmar liquidación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select items={items} value={value} onValueChange={(next) => onChange(next ?? 'all')}>
      <SelectTrigger size="sm" className="w-auto min-w-40">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
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
          <p className={`text-xs font-bold uppercase tracking-wide ${accent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
            {label}
          </p>
          <p className="mt-2 font-heading text-2xl font-semibold">{value}</p>
        </div>
        <Icon className={`size-5 ${accent ? 'text-primary-foreground/70' : 'text-primary'}`} />
      </CardContent>
    </Card>
  )
}
