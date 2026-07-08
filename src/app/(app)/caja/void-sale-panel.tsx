'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Ban, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatArs } from '@/lib/money/display'

type Branch = { id: string; name: string }
type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mercadopago_manual' | 'other'
type AdminSale = {
  id: string
  branchId: string
  branchName: string | null
  barberId: string
  barberName: string | null
  clientFirstName: string | null
  clientLastName: string | null
  total: string
  status: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'cancelled'
  paidAt: string | null
  paymentMethod: PaymentMethod | null
}

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  mercadopago_manual: 'Mercado Pago',
  other: 'Otro',
}

const ALL_BRANCHES = 'all'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function getError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : fallback
}

export function VoidSalePanel({ branches }: { branches: Branch[] }) {
  const [branchId, setBranchId] = useState(ALL_BRANCHES)
  const [from, setFrom] = useState(daysAgoIso(7))
  const [to, setTo] = useState(todayIso())
  const [rows, setRows] = useState<AdminSale[]>([])
  const [loading, setLoading] = useState(false)
  const [voidTarget, setVoidTarget] = useState<AdminSale | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: 'paid', from, to })
      if (branchId !== ALL_BRANCHES) params.set('branch_id', branchId)
      const response = await fetch(`/api/sales?${params}`)
      if (!response.ok) {
        toast.error(await getError(response, 'No se pudieron buscar las ventas'))
        return
      }
      setRows(await response.json())
    } finally {
      setLoading(false)
    }
  }, [branchId, from, to])

  useEffect(() => {
    const timer = window.setTimeout(() => void search(), 0)
    return () => window.clearTimeout(timer)
  }, [search])

  async function confirmVoid() {
    if (!voidTarget) return
    if (voidReason.trim().length < 3) {
      toast.error('Contá el motivo de la anulación')
      return
    }
    setVoiding(true)
    try {
      const response = await fetch(`/api/sales/${voidTarget.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      })
      if (!response.ok) {
        toast.error(await getError(response, 'No se pudo anular la venta'))
        return
      }
      const result = await response.json()
      toast.success('Venta anulada')
      if (result.warning) toast.warning(result.warning)
      setVoidTarget(null)
      setVoidReason('')
      setRows((current) => current.filter((row) => row.id !== voidTarget.id))
    } finally {
      setVoiding(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <Badge variant="destructive" className="w-fit">Solo admin</Badge>
        <CardTitle>Anular ventas</CardTitle>
        <CardDescription>
          Buscá una venta paga por fecha y sucursal, incluso si pertenece a una caja ya cerrada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="sm:max-w-40">
            <FieldLabel>Desde</FieldLabel>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field className="sm:max-w-40">
            <FieldLabel>Hasta</FieldLabel>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Field className="sm:max-w-56">
            <FieldLabel>Sucursal</FieldLabel>
            <Select
              items={[
                { value: ALL_BRANCHES, label: 'Todas las sucursales' },
                ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
              ]}
              value={branchId}
              onValueChange={(value) => setBranchId(value ?? ALL_BRANCHES)}
            >
              <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value={ALL_BRANCHES}>Todas las sucursales</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectGroup></SelectContent>
            </Select>
          </Field>
          <Button variant="outline" disabled={loading} onClick={() => void search()}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Buscar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Barbero</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    {loading ? 'Buscando...' : 'No hay ventas pagas en ese rango.'}
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.paidAt ? new Date(row.paidAt).toLocaleString('es-AR') : '-'}</TableCell>
                  <TableCell>{row.branchName ?? '-'}</TableCell>
                  <TableCell>{[row.clientFirstName, row.clientLastName].filter(Boolean).join(' ') || 'Walk-in'}</TableCell>
                  <TableCell>{row.barberName ?? '-'}</TableCell>
                  <TableCell>{row.paymentMethod ? paymentLabels[row.paymentMethod] : '-'}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatArs(row.total)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setVoidTarget(row); setVoidReason('') }}
                    >
                      <Ban />
                      Anular
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => { if (!open) { setVoidTarget(null); setVoidReason('') } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular venta</DialogTitle>
            <DialogDescription>
              Se revierte el efectivo o medio digital afectado y la comisión pendiente asociada. La venta
              queda auditada, no se borra.
            </DialogDescription>
          </DialogHeader>
          {voidTarget ? (
            <div className="rounded-xl border bg-secondary/50 p-3 text-sm">
              <p className="font-bold">{formatArs(voidTarget.total)} · {voidTarget.paymentMethod ? paymentLabels[voidTarget.paymentMethod] : ''}</p>
              <p className="text-muted-foreground">
                {[voidTarget.clientFirstName, voidTarget.clientLastName].filter(Boolean).join(' ') || 'Walk-in'}
                {' · '}
                {voidTarget.branchName}
              </p>
            </div>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel>Motivo de la anulación</FieldLabel>
              <Textarea
                autoFocus
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Explicá por qué se anula esta venta"
              />
            </Field>
          </FieldGroup>
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/8 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            Si la caja de esta venta ya está cerrada, el cierre histórico no se recalcula.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidTarget(null); setVoidReason('') }}>Cancelar</Button>
            <Button variant="destructive" disabled={voiding} onClick={() => void confirmVoid()}>
              {voiding ? 'Anulando...' : 'Confirmar anulación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
