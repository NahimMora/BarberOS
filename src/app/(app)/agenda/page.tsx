'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Combobox,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxTrailingIcon,
  ComboboxPopup,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarSync,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Minus,
  PlayCircle,
  Plus,
  UserPlus,
  UserX,
  X,
} from 'lucide-react'
import { calculateSaleTotals } from '@/lib/money/money'
import { ClientFormDialog, type ClientRecord } from '@/components/clients/client-form-dialog'
import { ClientQuickViewSheet } from '@/components/clients/client-quick-view-sheet'

type Appointment = {
  id: string
  branchId: string
  barberId: string
  clientId: string | null
  clientFirstName: string | null
  clientLastName: string | null
  status: string
  source: string
  startAt: string
  endAt: string
  notes: string | null
  saleId: string | null
}

type AppointmentServiceLine = { serviceId: string; priceAtTime: string; durationAtTime: number }

type Service = { id: string; name: string; durationMinutes: number; price: string }
type Slot = { startAt: string; endAt: string }
type Branch = { id: string; name: string; timezone: string | null }
type Barber = { id: string; fullName: string; branchId: string; displayColor: string | null }
type AgendaContext = {
  user: { id: string; role: 'admin' | 'receptionist' | 'barber' }
  branches: Branch[]
  barbers: Barber[]
}

const ANONYMOUS_CLIENT = '__anonymous__'
const ALL_BARBERS = '__all__'

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No se presentó',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'outline',
  confirmed: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  cancelled: 'destructive',
  no_show: 'secondary',
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  scheduled: Clock,
  confirmed: CalendarCheck,
  in_progress: PlayCircle,
  completed: CheckCheck,
  cancelled: Ban,
  no_show: UserX,
}

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] ?? Clock
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'outline'}>
      <Icon data-icon="inline-start" className="size-3" />
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

function BarberTag({ barber }: { barber: Barber | undefined }) {
  if (!barber) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: barber.displayColor ?? '#9a8f7a' }}
        aria-hidden="true"
      />
      {barber.fullName}
    </span>
  )
}

function toLocalDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default function AgendaPage() {
  const today = toLocalDateString(new Date())
  const [date, setDate] = useState(today)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [barberFilter, setBarberFilter] = useState(ALL_BARBERS)

  // New appointment dialog
  const [newOpen, setNewOpen] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [currentUser, setCurrentUser] = useState<AgendaContext['user'] | null>(null)
  const [barberId, setBarberId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [selectedClient, setSelectedClient] = useState(ANONYMOUS_CLIENT)
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<ClientRecord[]>([])
  const [clientSearchLoading, setClientSearchLoading] = useState(false)
  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [selectedService, setSelectedService] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)

  // Client quick-view
  const [quickViewClientId, setQuickViewClientId] = useState<string | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)

  function openClientQuickView(clientId: string) {
    setQuickViewClientId(clientId)
    setQuickViewOpen(true)
  }

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [rescheduleStart, setRescheduleStart] = useState('')
  const [rescheduleBarberId, setRescheduleBarberId] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [chargeTarget, setChargeTarget] = useState<Appointment | null>(null)
  const [chargeDiscount, setChargeDiscount] = useState('0.00')
  const [chargeMethod, setChargeMethod] = useState('cash')
  const [chargeNote, setChargeNote] = useState('')
  const [chargeServices, setChargeServices] = useState<AppointmentServiceLine[]>([])
  const [charging, setCharging] = useState(false)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments?date=${date}`)
      if (!res.ok) throw new Error('Error al cargar turnos')
      const data = await res.json()
      setAppointments(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [date])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchAppointments() }, [fetchAppointments])

  useEffect(() => {
    void (async () => {
      try {
        const [servicesResponse, contextResponse] = await Promise.all([
          fetch('/api/services'),
          fetch('/api/agenda-context'),
        ])
        if (servicesResponse.ok) setServices(await servicesResponse.json())
        if (contextResponse.ok) {
          const context: AgendaContext = await contextResponse.json()
          setBranches(context.branches ?? [])
          setBarbers(context.barbers ?? [])
          setCurrentUser(context.user)
        }
      } catch {
        // El listado diario igual funciona; esto solo enriquece la columna de barbero y el detalle de cobro.
      }
    })()
  }, [])

  const barberById = useMemo(() => new Map(barbers.map((barber) => [barber.id, barber])), [barbers])
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services])
  const barbersInView = useMemo(
    () => barbers.filter((barber) => appointments.some((appointment) => appointment.barberId === barber.id)),
    [barbers, appointments],
  )
  const visibleAppointments = useMemo(
    () => (barberFilter === ALL_BARBERS ? appointments : appointments.filter((a) => a.barberId === barberFilter)),
    [appointments, barberFilter],
  )
  const sortedAppointments = useMemo(() => {
    return [...visibleAppointments].sort((a, b) => {
      if (a.barberId !== b.barberId) {
        const nameA = barberById.get(a.barberId)?.fullName ?? ''
        const nameB = barberById.get(b.barberId)?.fullName ?? ''
        return nameA.localeCompare(nameB)
      }
      return a.startAt.localeCompare(b.startAt)
    })
  }, [visibleAppointments, barberById])
  const chargeSubtotal = chargeServices.length > 0
    ? calculateSaleTotals(chargeServices.map((item) => ({ quantity: 1, unitPrice: item.priceAtTime })), '0.00').subtotal
    : null

  function changeDate(delta: number) {
    const d = new Date(date + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + delta)
    setDate(toLocalDateString(d))
  }

  async function openNew() {
    const [sr, contextResponse] = await Promise.all([
      fetch('/api/services').then(r => r.json()),
      fetch('/api/agenda-context').then(r => r.json() as Promise<AgendaContext>),
    ])
    setServices(sr)
    setBranches(contextResponse.branches ?? [])
    setBarbers(contextResponse.barbers ?? [])
    setCurrentUser(contextResponse.user)
    const defaultBranch = contextResponse.branches?.[0]?.id ?? ''
    const defaultBarber = contextResponse.user?.role === 'barber'
      ? contextResponse.user.id
      : contextResponse.barbers?.find((barber) => barber.branchId === defaultBranch)?.id ?? ''
    setBranchId(defaultBranch)
    setBarberId(defaultBarber)
    setSelectedClient(ANONYMOUS_CLIENT)
    setClientQuery('')
    setClientResults([])
    setNewOpen(true)
    setSlots([])
    setSelectedSlot('')
  }

  function handleClientCreated(client: ClientRecord) {
    setClientResults((prev) => [client, ...prev.filter((c) => c.id !== client.id)])
    setSelectedClient(client.id)
    setCreateClientOpen(false)
  }

  async function openCharge(appointment: Appointment) {
    setChargeTarget(appointment)
    setChargeDiscount('0.00')
    setChargeMethod('cash')
    setChargeNote('')
    setChargeServices([])
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`)
      if (response.ok) {
        const detail = await response.json()
        setChargeServices(detail.services ?? [])
      }
    } catch {
      // El desglose es una ayuda visual; el cobro igual funciona sin él.
    }
  }

  async function chargeAppointment() {
    if (!chargeTarget) return
    setCharging(true)
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: chargeTarget.branchId,
          barberId: chargeTarget.barberId,
          clientId: chargeTarget.clientId,
          appointmentId: chargeTarget.id,
          discount: chargeDiscount || '0.00',
          paymentMethod: chargeMethod,
          paymentNote: chargeNote.trim() || null,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(typeof result.error === 'string' ? result.error : 'No se pudo cobrar el turno')
        return
      }
      toast.success('Cobro registrado')
      if (result.warning) toast.warning(result.warning)
      setChargeTarget(null)
      setChargeDiscount('0.00')
      setChargeMethod('cash')
      setChargeNote('')
      setChargeServices([])
      await fetchAppointments()
    } finally {
      setCharging(false)
    }
  }

  async function openReschedule(appointment: Appointment) {
    try {
      const contextResponse = await fetch('/api/agenda-context').then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar la disponibilidad')
        return response.json() as Promise<AgendaContext>
      })
      setBranches(contextResponse.branches ?? [])
      setBarbers(contextResponse.barbers ?? [])
      setCurrentUser(contextResponse.user)
      setRescheduleTarget(appointment)
      setRescheduleBarberId(appointment.barberId)
      setRescheduleStart(toDateTimeLocal(appointment.startAt))
      setRescheduleReason('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function fetchSlots() {
    if (!barberId || !branchId || !selectedService) return
    const svc = services.find(s => s.id === selectedService)
    if (!svc) return
    setLoadingSlots(true)
    try {
      const res = await fetch(
        `/api/availability?barber_id=${barberId}&branch_id=${branchId}&date=${date}&duration_minutes=${svc.durationMinutes}`,
      )
      const data = await res.json()
      setSlots(data.slots ?? [])
    } catch {
      toast.error('Error al cargar slots')
    } finally {
      setLoadingSlots(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (newOpen) void fetchSlots() }, [barberId, branchId, selectedService, date])

  useEffect(() => {
    if (!newOpen) return
    const timer = setTimeout(() => {
      setClientSearchLoading(true)
      fetch(`/api/clients?q=${encodeURIComponent(clientQuery)}`)
        .then((res) => res.json())
        .then((json) => setClientResults(json.data ?? []))
        .catch(() => toast.error('Error al buscar clientes'))
        .finally(() => setClientSearchLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [newOpen, clientQuery])

  async function handleCreate() {
    if (!selectedSlot || !selectedService || !barberId || !branchId) {
      toast.error('Completá todos los campos requeridos')
      return
    }
    setSaving(true)
    try {
      const slot = slots.find(s => s.startAt === selectedSlot)
      if (!slot) return
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          barberId,
          clientId: selectedClient === ANONYMOUS_CLIENT ? undefined : selectedClient,
          source: selectedClient === ANONYMOUS_CLIENT ? 'walk_in' : 'booked',
          startAt: slot.startAt,
          serviceIds: [selectedService],
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Error al crear turno')
        return
      }
      toast.success('Turno creado')
      setNewOpen(false)
      fetchAppointments()
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, newStatus: string, cancelReason?: string) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status_change', newStatus, cancelReason }),
    })
    if (!res.ok) {
      const json = await res.json()
      toast.error(json.error ?? 'Error al actualizar')
      return
    }
    toast.success('Turno actualizado')
    fetchAppointments()
  }

  async function handleReschedule() {
    if (!rescheduleTarget || !rescheduleStart || !rescheduleBarberId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/appointments/${rescheduleTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          startAt: new Date(rescheduleStart).toISOString(),
          barberId: rescheduleBarberId,
          reason: rescheduleReason || undefined,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        toast.error(body.error ?? 'No se pudo reprogramar')
        return
      }
      toast.success('Turno reprogramado')
      setRescheduleTarget(null)
      await fetchAppointments()
    } finally {
      setSaving(false)
    }
  }

  const activeCount = appointments.filter((appointment) =>
    ['scheduled', 'confirmed', 'in_progress'].includes(appointment.status),
  ).length
  const completedCount = appointments.filter((appointment) => appointment.status === 'completed').length
  const issueCount = appointments.filter((appointment) =>
    ['cancelled', 'no_show'].includes(appointment.status),
  ).length
  const formattedDate = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Agenda diaria"
        title="Turnos"
        actions={(
          <Button onClick={openNew} size="lg" className="min-h-10">
            <Plus data-icon="inline-start" />
            Nuevo turno
          </Button>
        )}
      />

      <Card elevated>
        <CardContent className="flex flex-col gap-5 py-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Fecha de trabajo</p>
              <p className="mt-1 font-heading text-2xl font-semibold capitalize">{formattedDate}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon-lg" aria-label="Día anterior" onClick={() => changeDate(-1)}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Input
                aria-label="Fecha de agenda"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-42 bg-card"
              />
              <Button variant="outline" size="icon-lg" aria-label="Día siguiente" onClick={() => changeDate(1)}>
                <ChevronRight aria-hidden="true" />
              </Button>
              {date !== today ? (
                <Button variant="secondary" onClick={() => setDate(today)}>Volver a hoy</Button>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-border/70 pt-4">
            <AgendaStat label="Pendientes" value={activeCount} tone="primary" />
            <AgendaStat label="Completados" value={completedCount} tone="success" />
            <AgendaStat label="Incidencias" value={issueCount} tone="warning" />
          </div>
        </CardContent>
      </Card>

      {barbersInView.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={barberFilter === ALL_BARBERS ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBarberFilter(ALL_BARBERS)}
          >
            Todos
          </Button>
          {barbersInView.map((barber) => (
            <Button
              key={barber.id}
              type="button"
              variant={barberFilter === barber.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBarberFilter(barber.id)}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: barber.displayColor ?? '#9a8f7a' }}
                aria-hidden="true"
              />
              {barber.fullName}
            </Button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3" aria-label="Cargando turnos">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Barbero</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sin turnos para este día
                  </TableCell>
                </TableRow>
              ) : (
                sortedAppointments.map((a) => (
                  <TableRow
                    key={a.id}
                    className="border-l-4"
                    style={{ borderLeftColor: barberById.get(a.barberId)?.displayColor ?? 'transparent' }}
                  >
                    <TableCell className="font-mono text-sm">
                      {new Date(a.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                      {' — '}
                      {new Date(a.endAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </TableCell>
                    <TableCell>
                      {a.clientId ? (
                        <button
                          type="button"
                          className="text-left underline-offset-2 hover:underline"
                          onClick={() => openClientQuickView(a.clientId as string)}
                        >
                          {[a.clientFirstName, a.clientLastName].filter(Boolean).join(' ') || 'Cliente'}
                        </button>
                      ) : (
                        'Walk-in'
                      )}
                    </TableCell>
                    <TableCell><BarberTag barber={barberById.get(a.barberId)} /></TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {a.source === 'walk_in' ? 'Walk-in' : 'Agendado'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {a.status === 'scheduled' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Confirmar"
                            aria-label="Confirmar turno"
                            onClick={() => updateStatus(a.id, 'confirmed')}
                          >
                            <Check className="text-success" />
                          </Button>
                        )}
                        {a.status === 'confirmed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Iniciar atención"
                            aria-label="Iniciar atención"
                            onClick={() => updateStatus(a.id, 'in_progress')}
                          >
                            <Check className="text-success" />
                          </Button>
                        )}
                        {a.status === 'in_progress' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Completar"
                            aria-label="Completar turno"
                            onClick={() => updateStatus(a.id, 'completed')}
                          >
                            <Check className="text-success" />
                          </Button>
                        )}
                        {a.status === 'completed' && !a.saleId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cobrar"
                            aria-label="Cobrar turno"
                            onClick={() => void openCharge(a)}
                          >
                            <CircleDollarSign className="text-primary" />
                          </Button>
                        )}
                        {(a.status === 'scheduled' || a.status === 'confirmed') && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Reprogramar"
                              aria-label="Reprogramar turno"
                              onClick={() => void openReschedule(a)}
                            >
                              <CalendarSync />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="No se presentó"
                              aria-label="Marcar ausencia"
                              onClick={() => updateStatus(a.id, 'no_show')}
                            >
                              <Minus className="text-warning" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancelar"
                              aria-label="Cancelar turno"
                              onClick={() => { setCancelTarget(a); setCancelReason('') }}
                            >
                              <X className="text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading ? (
        <div className="flex flex-col gap-3 md:hidden">
          {sortedAppointments.length === 0 ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
                <EmptyTitle>Sin turnos para este día</EmptyTitle>
                <EmptyDescription>Podés crear un turno o avanzar a otra fecha.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            sortedAppointments.map((appointment) => (
              <AppointmentMobileCard
                key={appointment.id}
                appointment={appointment}
                barber={barberById.get(appointment.barberId)}
                onStatusChange={updateStatus}
                onReschedule={openReschedule}
                onCancel={(target) => {
                  setCancelTarget(target)
                  setCancelReason('')
                }}
                onCharge={(target) => void openCharge(target)}
                onClientClick={openClientQuickView}
              />
            ))
          )}
        </div>
      ) : null}

      {/* New appointment dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo turno</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label>Sucursal</Label>
              <Select
                items={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                value={branchId}
                onValueChange={(value) => {
                  const nextBranchId = value ?? ''
                  setBranchId(nextBranchId)
                  const nextBarber = currentUser?.role === 'barber'
                    ? currentUser.id
                    : barbers.find((barber) => barber.branchId === nextBranchId)?.id ?? ''
                  setBarberId(nextBarber)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Barbero</Label>
              <Select
                items={barbers
                  .filter((barber) => barber.branchId === branchId)
                  .map((barber) => ({ value: barber.id, label: barber.fullName }))}
                value={barberId}
                onValueChange={(value) => setBarberId(value ?? '')}
                disabled={currentUser?.role === 'barber'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar barbero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {barbers
                      .filter((barber) => barber.branchId === branchId)
                      .map((barber) => (
                        <SelectItem key={barber.id} value={barber.id}>
                          {barber.fullName}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Servicio</Label>
              <Select
                items={services.map((service) => ({
                  value: service.id,
                  label: `${service.name} (${service.durationMinutes}min — $${service.price})`,
                }))}
                value={selectedService}
                onValueChange={(v) => setSelectedService(v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.durationMinutes}min — ${s.price})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Cliente (opcional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-1.5 py-1 text-xs"
                  onClick={() => setCreateClientOpen(true)}
                >
                  <UserPlus data-icon="inline-start" className="size-3.5" />
                  Crear cliente
                </Button>
              </div>
              <Combobox
                items={[
                  { value: ANONYMOUS_CLIENT, label: 'Walk-in (sin cliente)' },
                  ...clientResults.map((client) => ({
                    value: client.id,
                    label: [client.firstName, client.lastName].filter(Boolean).join(' ') || client.whatsappRaw || client.id,
                  })),
                ]}
                filter={null}
                value={selectedClient}
                onValueChange={(value) => setSelectedClient((value as string | null) ?? ANONYMOUS_CLIENT)}
                onInputValueChange={(value) => setClientQuery(value)}
              >
                <ComboboxInputGroup>
                  <ComboboxInput placeholder="Buscar por nombre o teléfono…" />
                  <ComboboxTrailingIcon loading={clientSearchLoading} />
                </ComboboxInputGroup>
                <ComboboxPopup>
                  <ComboboxItem value={ANONYMOUS_CLIENT}>Walk-in (sin cliente)</ComboboxItem>
                  {clientResults.map((c) => (
                    <ComboboxItem key={c.id} value={c.id}>
                      <span className="font-medium">
                        {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.whatsappRaw || 'Sin nombre'}
                      </span>
                      {c.whatsappRaw ? (
                        <span className="text-xs text-muted-foreground">{c.whatsappRaw}</span>
                      ) : null}
                    </ComboboxItem>
                  ))}
                  <ComboboxEmpty>
                    {clientQuery.trim() ? 'Sin resultados' : 'Escribí para buscar un cliente'}
                  </ComboboxEmpty>
                </ComboboxPopup>
              </Combobox>
            </div>
            <div className="space-y-1">
              <Label>Horario disponible</Label>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Cargando slots…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {barberId && branchId && selectedService
                    ? 'Sin slots disponibles para este día'
                    : 'Completá sucursal, barbero y servicio para ver slots'}
                </p>
              ) : (
                <Select
                  items={slots.map((slot) => ({
                    value: slot.startAt,
                    label: `${new Date(slot.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })} — ${new Date(slot.endAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}`,
                  }))}
                  value={selectedSlot}
                  onValueChange={(v) => setSelectedSlot(v ?? '')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegir horario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {slots.map(s => (
                        <SelectItem key={s.startAt} value={s.startAt}>
                          {new Date(s.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                          {' — '}
                          {new Date(s.endAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear turno'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reprogramar turno</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rescheduleStart">Nueva fecha y hora</Label>
              <Input
                id="rescheduleStart"
                type="datetime-local"
                value={rescheduleStart}
                onChange={(event) => setRescheduleStart(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Barbero</Label>
              <Select
                items={barbers
                  .filter((barber) => barber.branchId === rescheduleTarget?.branchId)
                  .map((barber) => ({ value: barber.id, label: barber.fullName }))}
                value={rescheduleBarberId}
                onValueChange={(value) => setRescheduleBarberId(value ?? '')}
                disabled={currentUser?.role === 'barber'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar barbero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {barbers
                      .filter((barber) => barber.branchId === rescheduleTarget?.branchId)
                      .map((barber) => (
                        <SelectItem key={barber.id} value={barber.id}>
                          {barber.fullName}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rescheduleReason">Motivo</Label>
              <Input
                id="rescheduleReason"
                value={rescheduleReason}
                onChange={(event) => setRescheduleReason(event.target.value)}
                placeholder="Cambio solicitado por el cliente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>Cancelar</Button>
            <Button onClick={() => void handleReschedule()} disabled={saving || !rescheduleStart}>
              {saving ? 'Guardando…' : 'Reprogramar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar turno</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancelReason">Motivo de cancelación</Label>
            <Input
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ingresá el motivo…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Volver</Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim()}
              onClick={async () => {
                if (!cancelTarget) return
                await updateStatus(cancelTarget.id, 'cancelled', cancelReason.trim())
                setCancelTarget(null)
              }}
            >
              Confirmar cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!chargeTarget} onOpenChange={(open) => !open && setChargeTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cobrar turno</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {chargeServices.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-xl bg-secondary p-3 text-sm">
                {chargeServices.map((item) => (
                  <div key={item.serviceId} className="flex items-center justify-between">
                    <span>{serviceById.get(item.serviceId)?.name ?? 'Servicio'}</span>
                    <span className="font-mono tabular-nums">${item.priceAtTime}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border/60 pt-1.5 font-medium">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">${chargeSubtotal}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-secondary p-3 text-sm">
                Se cobrarán los servicios y precios guardados al crear el turno.
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="chargeDiscount">Descuento</Label>
              <MoneyInput
                id="chargeDiscount"
                value={chargeDiscount}
                onValueChange={setChargeDiscount}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="chargeNote">Referencia del pago (opcional)</Label>
              <Input
                id="chargeNote"
                value={chargeNote}
                onChange={(event) => setChargeNote(event.target.value)}
                placeholder="Ej. comprobante o últimos 4 dígitos"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Medio de pago</Label>
              <Select
                items={[
                  { value: 'cash', label: 'Efectivo' },
                  { value: 'transfer', label: 'Transferencia' },
                  { value: 'card', label: 'Tarjeta' },
                  { value: 'mercadopago_manual', label: 'Mercado Pago' },
                  { value: 'other', label: 'Otro' },
                ]}
                value={chargeMethod}
                onValueChange={(value) => setChargeMethod(value ?? 'cash')}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="mercadopago_manual">Mercado Pago</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectGroup></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeTarget(null)}>Cancelar</Button>
            <Button disabled={charging} onClick={() => void chargeAppointment()}>
              <CircleDollarSign />
              {charging ? 'Cobrando...' : 'Confirmar cobro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientFormDialog
        open={createClientOpen}
        onOpenChange={setCreateClientOpen}
        onSaved={handleClientCreated}
      />

      <ClientQuickViewSheet
        clientId={quickViewClientId}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />
    </div>
  )
}

function AgendaStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'primary' | 'success' | 'warning'
}) {
  const toneClass = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning-foreground',
  }[tone]

  return (
    <div className="rounded-xl bg-muted/55 px-3 py-3 sm:px-4">
      <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

function AppointmentMobileCard({
  appointment,
  barber,
  onStatusChange,
  onReschedule,
  onCancel,
  onCharge,
  onClientClick,
}: {
  appointment: Appointment
  barber: Barber | undefined
  onStatusChange: (id: string, status: string, reason?: string) => Promise<void>
  onReschedule: (appointment: Appointment) => Promise<void>
  onCancel: (appointment: Appointment) => void
  onCharge: (appointment: Appointment) => void
  onClientClick: (clientId: string) => void
}) {
  const start = new Date(appointment.startAt).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const end = new Date(appointment.endAt).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const clientName = [appointment.clientFirstName, appointment.clientLastName]
    .filter(Boolean)
    .join(' ') || 'Walk-in'

  return (
    <Card elevated className="border-l-4" style={{ borderLeftColor: barber?.displayColor ?? 'transparent' }}>
      <CardContent className="flex flex-col gap-4 py-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            {appointment.clientId ? (
              <button
                type="button"
                className="text-left font-heading text-xl font-semibold underline-offset-2 hover:underline"
                onClick={() => onClientClick(appointment.clientId as string)}
              >
                {clientName}
              </button>
            ) : (
              <p className="font-heading text-xl font-semibold">{clientName}</p>
            )}
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-muted-foreground">
              {start} - {end}
            </p>
            <div className="mt-1"><BarberTag barber={barber} /></div>
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
          {appointment.status === 'scheduled' ? (
            <Button size="sm" className="min-h-10" onClick={() => void onStatusChange(appointment.id, 'confirmed')}>
              <Check data-icon="inline-start" />
              Confirmar
            </Button>
          ) : null}
          {appointment.status === 'confirmed' ? (
            <Button size="sm" className="min-h-10" onClick={() => void onStatusChange(appointment.id, 'in_progress')}>
              <Check data-icon="inline-start" />
              Iniciar
            </Button>
          ) : null}
          {appointment.status === 'in_progress' ? (
            <Button size="sm" className="min-h-10" onClick={() => void onStatusChange(appointment.id, 'completed')}>
              <Check data-icon="inline-start" />
              Completar
            </Button>
          ) : null}
          {appointment.status === 'completed' && !appointment.saleId ? (
            <Button size="sm" className="min-h-10" onClick={() => onCharge(appointment)}>
              <CircleDollarSign data-icon="inline-start" />
              Cobrar
            </Button>
          ) : null}
          {['scheduled', 'confirmed'].includes(appointment.status) ? (
            <>
              <Button variant="outline" size="sm" className="min-h-10" onClick={() => void onReschedule(appointment)}>
                <CalendarSync data-icon="inline-start" />
                Reprogramar
              </Button>
              <Button variant="ghost" size="sm" className="min-h-10" onClick={() => void onStatusChange(appointment.id, 'no_show')}>
                Ausente
              </Button>
              <Button variant="destructive" size="sm" className="min-h-10" onClick={() => onCancel(appointment)}>
                Cancelar
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}
