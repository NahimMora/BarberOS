'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  Landmark,
  LockKeyhole,
  Minus,
  Plus,
  ReceiptText,
  RefreshCw,
  Smartphone,
  WalletCards,
  X,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { calculateSaleTotals } from '@/lib/money/money'
import { formatArs } from '@/lib/money/display'

type Branch = { id: string; name: string }
type Barber = { id: string; fullName: string; branchId: string }
type AgendaContext = {
  user: { role: 'admin' | 'receptionist' | 'barber' }
  branches: Branch[]
  barbers: Barber[]
}
type Service = { id: string; name: string; price: string; active: boolean }
type Client = {
  id: string
  firstName: string | null
  lastName: string | null
}
type Appointment = {
  id: string
  barberId: string
  clientId: string | null
  clientFirstName: string | null
  clientLastName: string | null
  startAt: string
}
type Sale = {
  id: string
  appointmentId: string | null
  total: string
  paymentMethod: PaymentMethod
  paidAt: string
}
type CashSession = {
  id: string
  branchId: string
  openingAmount: string
  openedAt: string
  status: 'open' | 'closed' | 'reconciled'
  expectedCash: string | null
  countedCash: string | null
  cashDifference: string | null
}
type CashMovement = {
  id: string
  type: 'sale' | 'income' | 'expense' | 'withdrawal' | 'adjustment'
  amount: string
  paymentMethod: PaymentMethod
  note: string | null
  createdAt: string
}
type CashSnapshot = {
  expectedCash: string
  expectedTransfer: string
  expectedCard: string
  expectedMercadopagoManual: string
  expectedOther: string
  expectedTotal: string
}
type CashResponse = {
  openSession: CashSession | null
  liveSnapshot: CashSnapshot | null
  movements: CashMovement[]
  recentSessions: CashSession[]
}
type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mercadopago_manual' | 'other'
type SelectedItem = { serviceId: string; quantity: number }

const MANUAL_SALE = 'manual'
const ANONYMOUS_CLIENT = 'anonymous'
const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  mercadopago_manual: 'Mercado Pago',
  other: 'Otro',
}
const movementLabels: Record<CashMovement['type'], string> = {
  sale: 'Venta',
  income: 'Ingreso',
  expense: 'Gasto',
  withdrawal: 'Retiro',
  adjustment: 'Ajuste',
}

function fullName(client: Client) {
  return [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Cliente sin nombre'
}

async function getError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : fallback
}

export function CashConsole() {
  const [context, setContext] = useState<AgendaContext | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [branchId, setBranchId] = useState('')
  const [cash, setCash] = useState<CashResponse | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('0.00')
  const [appointmentId, setAppointmentId] = useState(MANUAL_SALE)
  const [barberId, setBarberId] = useState('')
  const [clientId, setClientId] = useState(ANONYMOUS_CLIENT)
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [items, setItems] = useState<SelectedItem[]>([])
  const [discount, setDiscount] = useState('0.00')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentNote, setPaymentNote] = useState('')
  const [savingSale, setSavingSale] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<'income' | 'expense' | 'withdrawal'>('expense')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementMethod, setMovementMethod] = useState<PaymentMethod>('cash')
  const [movementNote, setMovementNote] = useState('')
  const [savingMovement, setSavingMovement] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [countedCash, setCountedCash] = useState('')
  const [closing, setClosing] = useState(false)
  const [adjustmentSessionId, setAdjustmentSessionId] = useState<string | null>(null)
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentMethod, setAdjustmentMethod] = useState<PaymentMethod>('cash')
  const [adjustmentNote, setAdjustmentNote] = useState('')
  const [savingAdjustment, setSavingAdjustment] = useState(false)

  useEffect(() => {
    async function loadContext() {
      try {
        const [contextResponse, servicesResponse, clientsResponse] = await Promise.all([
          fetch('/api/agenda-context'),
          fetch('/api/services'),
          fetch('/api/clients?limit=200'),
        ])
        if (!contextResponse.ok || !servicesResponse.ok || !clientsResponse.ok) {
          throw new Error('No se pudo cargar el contexto de caja')
        }
        const [contextData, serviceData, clientData] = await Promise.all([
          contextResponse.json(),
          servicesResponse.json(),
          clientsResponse.json(),
        ])
        setContext(contextData)
        setServices(serviceData.filter((service: Service) => service.active))
        setClients(clientData.data)
        setBranchId(contextData.branches[0]?.id ?? '')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al cargar caja')
      } finally {
        setLoading(false)
      }
    }
    void loadContext()
  }, [])

  const refreshBranch = useCallback(async (showSpinner = true) => {
    if (!branchId) return
    if (showSpinner) setRefreshing(true)
    try {
      const [cashResponse, appointmentsResponse, salesResponse] = await Promise.all([
        fetch(`/api/cash-sessions?branch_id=${branchId}`),
        fetch(`/api/appointments?branch_id=${branchId}&status=completed`),
        fetch(`/api/sales?branch_id=${branchId}`),
      ])
      if (!cashResponse.ok || !appointmentsResponse.ok || !salesResponse.ok) {
        throw new Error('No se pudo actualizar la operación de caja')
      }
      const [cashData, appointmentData, salesData] = await Promise.all([
        cashResponse.json(),
        appointmentsResponse.json(),
        salesResponse.json(),
      ])
      setCash(cashData)
      setAppointments(appointmentData)
      setSales(salesData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar caja')
    } finally {
      setRefreshing(false)
    }
  }, [branchId])

  useEffect(() => {
    if (!branchId) return
    const timer = window.setTimeout(() => void refreshBranch(), 0)
    return () => window.clearTimeout(timer)
  }, [branchId, refreshBranch])

  const branchBarbers = useMemo(
    () => context?.barbers.filter((barber) => barber.branchId === branchId) ?? [],
    [branchId, context],
  )
  const paidAppointmentIds = useMemo(
    () => new Set(sales.map((sale) => sale.appointmentId).filter(Boolean)),
    [sales],
  )
  const chargeableAppointments = useMemo(
    () => appointments.filter((appointment) => !paidAppointmentIds.has(appointment.id)),
    [appointments, paidAppointmentIds],
  )
  const selectedAppointment = chargeableAppointments.find((appointment) => appointment.id === appointmentId)
  const saleTotals = useMemo(() => {
    if (appointmentId !== MANUAL_SALE || items.length === 0) return null
    try {
      return calculateSaleTotals(items.map((item) => ({
        quantity: item.quantity,
        unitPrice: services.find((service) => service.id === item.serviceId)?.price ?? '0.00',
      })), discount || '0.00')
    } catch {
      return null
    }
  }, [appointmentId, discount, items, services])

  function changeAppointment(value: string | null) {
    const next = value ?? MANUAL_SALE
    setAppointmentId(next)
    if (next === MANUAL_SALE) return
    const appointment = chargeableAppointments.find((candidate) => candidate.id === next)
    if (!appointment) return
    setBarberId(appointment.barberId)
    setClientId(appointment.clientId ?? ANONYMOUS_CLIENT)
  }

  function addService() {
    if (!selectedServiceId) return
    setItems((current) => {
      const existing = current.find((item) => item.serviceId === selectedServiceId)
      if (existing) {
        return current.map((item) => item.serviceId === selectedServiceId
          ? { ...item, quantity: Math.min(20, item.quantity + 1) }
          : item)
      }
      return [...current, { serviceId: selectedServiceId, quantity: 1 }]
    })
    setSelectedServiceId('')
  }

  async function openCash() {
    if (!branchId) return
    const response = await fetch('/api/cash-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, openingAmount }),
    })
    if (!response.ok) {
      toast.error(await getError(response, 'No se pudo abrir la caja'))
      return
    }
    toast.success('Caja abierta')
    await refreshBranch(false)
  }

  async function chargeSale() {
    if (!cash?.openSession) return
    if (!barberId) {
      toast.error('Seleccioná un barbero')
      return
    }
    if (appointmentId === MANUAL_SALE && items.length === 0) {
      toast.error('Agregá al menos un servicio')
      return
    }

    setSavingSale(true)
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          barberId,
          clientId: clientId === ANONYMOUS_CLIENT ? null : clientId,
          appointmentId: appointmentId === MANUAL_SALE ? null : appointmentId,
          items: appointmentId === MANUAL_SALE ? items : undefined,
          discount: discount || '0.00',
          paymentMethod,
          paymentNote: paymentNote || null,
        }),
      })
      if (!response.ok) {
        toast.error(await getError(response, 'No se pudo registrar el cobro'))
        return
      }
      const result = await response.json()
      toast.success(`Cobro registrado por ${formatArs(result.sale.total)}`)
      if (result.warning) toast.warning(result.warning)
      setAppointmentId(MANUAL_SALE)
      setBarberId('')
      setClientId(ANONYMOUS_CLIENT)
      setItems([])
      setDiscount('0.00')
      setPaymentNote('')
      await refreshBranch(false)
    } finally {
      setSavingSale(false)
    }
  }

  async function saveMovement() {
    if (!cash?.openSession) return
    setSavingMovement(true)
    try {
      const response = await fetch('/api/cash-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashSessionId: cash.openSession.id,
          type: movementType,
          amount: movementAmount,
          paymentMethod: movementMethod,
          note: movementNote,
        }),
      })
      if (!response.ok) {
        toast.error(await getError(response, 'No se pudo registrar el movimiento'))
        return
      }
      toast.success('Movimiento registrado')
      setMovementOpen(false)
      setMovementAmount('')
      setMovementNote('')
      await refreshBranch(false)
    } finally {
      setSavingMovement(false)
    }
  }

  async function closeCash() {
    if (!cash?.openSession) return
    setClosing(true)
    try {
      const response = await fetch(`/api/cash-sessions/${cash.openSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', countedCash }),
      })
      if (!response.ok) {
        toast.error(await getError(response, 'No se pudo cerrar la caja'))
        return
      }
      const result = await response.json()
      toast.success(`Caja cerrada. Diferencia: ${formatArs(result.cashDifference)}`)
      setCloseOpen(false)
      setCountedCash('')
      await refreshBranch(false)
    } finally {
      setClosing(false)
    }
  }

  async function saveAdjustment() {
    if (!adjustmentSessionId) return
    setSavingAdjustment(true)
    try {
      const response = await fetch('/api/cash-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashSessionId: adjustmentSessionId,
          type: 'adjustment',
          amount: adjustmentAmount,
          paymentMethod: adjustmentMethod,
          note: adjustmentNote,
        }),
      })
      if (!response.ok) {
        toast.error(await getError(response, 'No se pudo registrar el ajuste'))
        return
      }
      toast.success('Ajuste auditado sin modificar el snapshot del cierre')
      setAdjustmentSessionId(null)
      setAdjustmentAmount('')
      setAdjustmentNote('')
      await refreshBranch(false)
    } finally {
      setSavingAdjustment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-36 rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-52 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!context || context.branches.length === 0) {
    return (
      <PageHeader
        eyebrow="Dinero"
        title="Caja"
        description="No hay sucursales disponibles para operar."
      />
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Dinero"
        title="Caja diaria"
        description="Cobrá, separá cada medio de pago y cerrá el efectivo físico con una diferencia auditable."
        actions={(
          <Button
            variant="outline"
            size="lg"
            disabled={refreshing}
            onClick={() => void refreshBranch()}
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </Button>
        )}
      />

      <Card className="paper-surface">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Field className="w-full sm:max-w-sm">
            <FieldLabel>Sucursal operativa</FieldLabel>
            <Select
              items={context.branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              value={branchId}
              onValueChange={(value) => setBranchId(value ?? '')}
            >
              <SelectTrigger className="h-11 w-full bg-card">
                <SelectValue placeholder="Seleccionar sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {context.branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
            <span className={`size-2.5 rounded-full ${cash?.openSession ? 'bg-success' : 'bg-muted-foreground/40'}`} />
            <div>
              <p className="text-sm font-bold">{cash?.openSession ? 'Caja abierta' : 'Caja cerrada'}</p>
              <p className="text-xs text-muted-foreground">
                {cash?.openSession
                  ? `Desde ${new Date(cash.openSession.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Abrila para comenzar a cobrar'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!cash?.openSession ? (
        <Card className="border-primary/20 bg-primary text-primary-foreground">
          <CardHeader>
            <Badge className="w-fit bg-primary-foreground/12 text-primary-foreground">Inicio de jornada</Badge>
            <CardTitle className="text-3xl">Abrí la caja antes del primer cobro.</CardTitle>
            <CardDescription className="max-w-xl text-primary-foreground/70">
              Informá únicamente el efectivo físico inicial. Los medios digitales se acumulan desde cero.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="sm:max-w-xs">
              <FieldLabel className="text-primary-foreground">Efectivo inicial</FieldLabel>
              <Input
                inputMode="decimal"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                className="h-11 bg-primary-foreground text-foreground"
              />
            </Field>
            <Button
              size="lg"
              variant="secondary"
              className="min-h-11"
              onClick={() => void openCash()}
            >
              <LockKeyhole />
              Abrir caja
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MoneyStat icon={Banknote} label="Efectivo esperado" value={cash.liveSnapshot?.expectedCash} accent />
            <MoneyStat icon={Landmark} label="Transferencias" value={cash.liveSnapshot?.expectedTransfer} />
            <MoneyStat icon={CreditCard} label="Tarjetas" value={cash.liveSnapshot?.expectedCard} />
            <MoneyStat icon={Smartphone} label="Mercado Pago" value={cash.liveSnapshot?.expectedMercadopagoManual} />
            <MoneyStat icon={WalletCards} label="Total operativo" value={cash.liveSnapshot?.expectedTotal} />
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="paper-surface">
              <CardHeader>
                <Badge variant="secondary" className="w-fit">Cobro manual</Badge>
                <CardTitle className="text-2xl">Registrar venta</CardTitle>
                <CardDescription>
                  Cobrá un turno completado o armá una venta rápida para un walk-in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Origen</FieldLabel>
                    <Select
                      items={[
                        { value: MANUAL_SALE, label: 'Venta rápida / walk-in' },
                        ...chargeableAppointments.map((appointment) => ({
                          value: appointment.id,
                          label: `${new Date(appointment.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · ${[appointment.clientFirstName, appointment.clientLastName].filter(Boolean).join(' ') || 'Walk-in'}`,
                        })),
                      ]}
                      value={appointmentId}
                      onValueChange={changeAppointment}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={MANUAL_SALE}>Venta rápida / walk-in</SelectItem>
                          {chargeableAppointments.map((appointment) => (
                            <SelectItem key={appointment.id} value={appointment.id}>
                              {new Date(appointment.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              {' · '}
                              {[appointment.clientFirstName, appointment.clientLastName].filter(Boolean).join(' ') || 'Walk-in'}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Barbero</FieldLabel>
                      <Select
                        items={branchBarbers.map((barber) => ({ value: barber.id, label: barber.fullName }))}
                        value={barberId}
                        disabled={appointmentId !== MANUAL_SALE}
                        onValueChange={(value) => setBarberId(value ?? '')}
                      >
                        <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent><SelectGroup>
                          {branchBarbers.map((barber) => (
                            <SelectItem key={barber.id} value={barber.id}>{barber.fullName}</SelectItem>
                          ))}
                        </SelectGroup></SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Cliente</FieldLabel>
                      <Select
                        items={[
                          { value: ANONYMOUS_CLIENT, label: 'Walk-in anónimo' },
                          ...clients.map((client) => ({ value: client.id, label: fullName(client) })),
                        ]}
                        value={clientId}
                        disabled={appointmentId !== MANUAL_SALE}
                        onValueChange={(value) => setClientId(value ?? ANONYMOUS_CLIENT)}
                      >
                        <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectGroup>
                          <SelectItem value={ANONYMOUS_CLIENT}>Walk-in anónimo</SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>{fullName(client)}</SelectItem>
                          ))}
                        </SelectGroup></SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {appointmentId === MANUAL_SALE ? (
                    <Field>
                      <FieldLabel>Servicios</FieldLabel>
                      <div className="flex gap-2">
                        <Select
                          items={services.map((service) => ({
                            value: service.id,
                            label: `${service.name} · ${formatArs(service.price)}`,
                          }))}
                          value={selectedServiceId}
                          onValueChange={(value) => setSelectedServiceId(value ?? '')}
                        >
                          <SelectTrigger className="h-11 min-w-0 flex-1"><SelectValue placeholder="Agregar servicio" /></SelectTrigger>
                          <SelectContent><SelectGroup>
                            {services.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name} · {formatArs(service.price)}
                              </SelectItem>
                            ))}
                          </SelectGroup></SelectContent>
                        </Select>
                        <Button type="button" variant="secondary" className="h-11" onClick={addService}>
                          <Plus />
                          Agregar
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-col gap-2">
                        {items.map((item) => {
                          const service = services.find((candidate) => candidate.id === item.serviceId)
                          return (
                            <div key={item.serviceId} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold">{service?.name}</p>
                                <p className="text-xs text-muted-foreground">{formatArs(service?.price)}</p>
                              </div>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                aria-label="Reducir cantidad"
                                onClick={() => setItems((current) => current
                                  .map((candidate) => candidate.serviceId === item.serviceId
                                    ? { ...candidate, quantity: candidate.quantity - 1 }
                                    : candidate)
                                  .filter((candidate) => candidate.quantity > 0))}
                              >
                                <Minus />
                              </Button>
                              <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                aria-label="Aumentar cantidad"
                                onClick={() => setItems((current) => current.map((candidate) => candidate.serviceId === item.serviceId
                                  ? { ...candidate, quantity: Math.min(20, candidate.quantity + 1) }
                                  : candidate))}
                              >
                                <Plus />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Quitar servicio"
                                onClick={() => setItems((current) => current.filter((candidate) => candidate.serviceId !== item.serviceId))}
                              >
                                <X />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </Field>
                  ) : (
                    <div className="rounded-xl border border-info/20 bg-info/8 p-3 text-sm">
                      Se usarán los servicios y precios congelados al crear el turno de{' '}
                      <strong>{[selectedAppointment?.clientFirstName, selectedAppointment?.clientLastName].filter(Boolean).join(' ') || 'walk-in'}</strong>.
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Descuento</FieldLabel>
                      <Input
                        inputMode="decimal"
                        value={discount}
                        onChange={(event) => setDiscount(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Medio de pago</FieldLabel>
                      <Select
                        items={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
                        value={paymentMethod}
                        onValueChange={(value) => setPaymentMethod((value ?? 'cash') as PaymentMethod)}
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectGroup>
                          {Object.entries(paymentLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectGroup></SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>Referencia del pago (opcional)</FieldLabel>
                    <Input
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      placeholder="Ej. comprobante o últimos 4 dígitos"
                    />
                  </Field>

                  <div className="flex flex-col gap-3 rounded-2xl bg-primary p-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground/60">
                        Total a cobrar
                      </p>
                      <p className="mt-1 font-heading text-3xl font-semibold">
                        {appointmentId === MANUAL_SALE
                          ? formatArs(saleTotals?.total)
                          : 'Precio del turno'}
                      </p>
                    </div>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="min-h-11"
                      disabled={savingSale}
                      onClick={() => void chargeSale()}
                    >
                      <CircleDollarSign />
                      {savingSale ? 'Registrando...' : 'Confirmar cobro'}
                    </Button>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Control de efectivo</CardTitle>
                  <CardDescription>
                    Solo este importe se compara con el conteo físico al cerrar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="rounded-2xl bg-secondary p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Esperado en billetes
                    </p>
                    <p className="mt-2 font-heading text-4xl font-semibold">
                      {formatArs(cash.liveSnapshot?.expectedCash)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setMovementOpen(true)}>
                      <ArrowDownLeft />
                      Movimiento
                    </Button>
                    <Button variant="destructive" onClick={() => setCloseOpen(true)}>
                      <LockKeyhole />
                      Cerrar caja
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Últimos movimientos</CardTitle>
                  <CardDescription>{cash.movements.length} registros en la sesión.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="max-h-96 overflow-auto">
                    {cash.movements.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Todavía no hay movimientos.
                      </p>
                    ) : cash.movements.slice(0, 12).map((movement) => {
                      const negative = movement.type === 'expense' || movement.type === 'withdrawal'
                      return (
                        <div key={movement.id} className="flex items-center gap-3 border-t px-4 py-3 first:border-t-0">
                          <div className={`flex size-9 items-center justify-center rounded-xl ${negative ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                            {negative ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{movement.note || movementLabels[movement.type]}</p>
                            <p className="text-xs text-muted-foreground">
                              {paymentLabels[movement.paymentMethod]} · {new Date(movement.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <p className={`text-sm font-bold ${negative ? 'text-destructive' : ''}`}>
                            {negative ? '-' : ''}{formatArs(movement.amount)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {cash?.recentSessions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Cierres recientes</CardTitle>
            <CardDescription>Snapshots históricos que ya no cambian.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Esperado efectivo</TableHead>
                  <TableHead>Contado</TableHead>
                  <TableHead>Diferencia</TableHead>
                  {context.user.role === 'admin' ? <TableHead className="w-24" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cash.recentSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{new Date(session.openedAt).toLocaleString('es-AR')}</TableCell>
                    <TableCell>{formatArs(session.expectedCash)}</TableCell>
                    <TableCell>{formatArs(session.countedCash)}</TableCell>
                    <TableCell className={session.cashDifference !== '0.00' ? 'font-bold text-destructive' : 'font-bold text-success'}>
                      {formatArs(session.cashDifference)}
                    </TableCell>
                    {context.user.role === 'admin' ? (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjustmentSessionId(session.id)}
                        >
                          Ajustar
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>
              Los gastos y retiros restan del medio seleccionado; los ingresos suman.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <Select
                items={[
                  { value: 'income', label: 'Ingreso adicional' },
                  { value: 'expense', label: 'Gasto' },
                  { value: 'withdrawal', label: 'Retiro' },
                ]}
                value={movementType}
                onValueChange={(value) => setMovementType((value ?? 'expense') as typeof movementType)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  <SelectItem value="income">Ingreso adicional</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="withdrawal">Retiro</SelectItem>
                </SelectGroup></SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Importe</FieldLabel>
                <Input inputMode="decimal" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Medio</FieldLabel>
                <Select
                  items={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
                  value={movementMethod}
                  onValueChange={(value) => setMovementMethod((value ?? 'cash') as PaymentMethod)}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    {Object.entries(paymentLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectGroup></SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel>Motivo</FieldLabel>
              <Textarea value={movementNote} onChange={(event) => setMovementNote(event.target.value)} placeholder="Detalle necesario para auditoría" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementOpen(false)}>Cancelar</Button>
            <Button disabled={savingMovement} onClick={() => void saveMovement()}>
              {savingMovement ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
            <DialogDescription>
              Contá únicamente efectivo físico. Transferencias y tarjetas quedan conciliadas por separado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Esperado</p>
              <p className="mt-1 text-xl font-bold">{formatArs(cash?.liveSnapshot?.expectedCash)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total operativo</p>
              <p className="mt-1 text-xl font-bold">{formatArs(cash?.liveSnapshot?.expectedTotal)}</p>
            </div>
          </div>
          <Field>
            <FieldLabel>Efectivo contado</FieldLabel>
            <Input
              autoFocus
              inputMode="decimal"
              value={countedCash}
              onChange={(event) => setCountedCash(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Volver</Button>
            <Button variant="destructive" disabled={closing} onClick={() => void closeCash()}>
              <LockKeyhole />
              {closing ? 'Cerrando...' : 'Confirmar cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(adjustmentSessionId)}
        onOpenChange={(open) => !open && setAdjustmentSessionId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar una caja cerrada</DialogTitle>
            <DialogDescription>
              El snapshot histórico no se modifica. El importe firmado queda como movimiento y audit log.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Importe firmado</FieldLabel>
              <Input
                inputMode="decimal"
                value={adjustmentAmount}
                onChange={(event) => setAdjustmentAmount(event.target.value)}
                placeholder="-500.00 o 500.00"
              />
            </Field>
            <Field>
              <FieldLabel>Medio afectado</FieldLabel>
              <Select
                items={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
                value={adjustmentMethod}
                onValueChange={(value) => setAdjustmentMethod((value ?? 'cash') as PaymentMethod)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  {Object.entries(paymentLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Motivo de corrección</FieldLabel>
              <Textarea
                value={adjustmentNote}
                onChange={(event) => setAdjustmentNote(event.target.value)}
                placeholder="Explicá qué se corrige y por qué"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentSessionId(null)}>Cancelar</Button>
            <Button disabled={savingAdjustment} onClick={() => void saveAdjustment()}>
              {savingAdjustment ? 'Guardando...' : 'Registrar ajuste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MoneyStat({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof ReceiptText
  label: string
  value: string | null | undefined
  accent?: boolean
}) {
  return (
    <Card className={accent ? 'border-primary/30 bg-primary text-primary-foreground' : ''}>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.12em] ${accent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
            {label}
          </p>
          <p className="mt-2 font-heading text-2xl font-semibold">{formatArs(value)}</p>
        </div>
        <Icon className={`size-5 ${accent ? 'text-primary-foreground/70' : 'text-primary'}`} />
      </CardContent>
    </Card>
  )
}
