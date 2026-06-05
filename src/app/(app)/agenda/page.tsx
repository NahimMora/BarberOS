'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Check, X, Minus } from 'lucide-react'

type Appointment = {
  id: string
  barberId: string
  clientId: string | null
  status: string
  source: string
  startAt: string
  endAt: string
  notes: string | null
}

type Client = { id: string; firstName: string | null; lastName: string | null; whatsappRaw: string | null }
type Service = { id: string; name: string; durationMinutes: number; price: string }
type Slot = { startAt: string; endAt: string }

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
  confirmed: 'default',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  no_show: 'secondary',
}

function toLocalDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default function AgendaPage() {
  const today = toLocalDateString(new Date())
  const [date, setDate] = useState(today)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)

  // New appointment dialog
  const [newOpen, setNewOpen] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [barberId, setBarberId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')

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

  function changeDate(delta: number) {
    const d = new Date(date + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + delta)
    setDate(toLocalDateString(d))
  }

  async function openNew() {
    // Fetch clients and services for the form
    const [cr, sr] = await Promise.all([
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/services').then(r => r.json()),
    ])
    setClients(cr.data ?? [])
    setServices(sr)
    setNewOpen(true)
    setSlots([])
    setSelectedSlot('')
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
          clientId: selectedClient || undefined,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo turno
        </Button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
        <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {date !== today && (
          <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
            Hoy
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sin turnos para este día
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(a.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                      {' — '}
                      {new Date(a.endAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </TableCell>
                    <TableCell>{a.clientId ?? 'Walk-in'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[a.status] ?? 'outline'}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </Badge>
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
                            onClick={() => updateStatus(a.id, 'confirmed')}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {(a.status === 'confirmed' || a.status === 'in_progress') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Completar"
                            onClick={() => updateStatus(a.id, 'completed')}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {(a.status === 'scheduled' || a.status === 'confirmed') && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="No se presentó"
                              onClick={() => updateStatus(a.id, 'no_show')}
                            >
                              <Minus className="h-4 w-4 text-yellow-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancelar"
                              onClick={() => { setCancelTarget(a); setCancelReason('') }}
                            >
                              <X className="h-4 w-4 text-red-600" />
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

      {/* New appointment dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo turno</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label>Sucursal ID</Label>
              <Input
                placeholder="UUID de sucursal"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Barbero ID</Label>
              <Input
                placeholder="UUID de barbero"
                value={barberId}
                onChange={(e) => setBarberId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Servicio</Label>
              <Select value={selectedService} onValueChange={(v) => setSelectedService(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes}min — ${s.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cliente (opcional)</Label>
              <Select value={selectedClient} onValueChange={(v) => setSelectedClient(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in / anónimo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Walk-in (sin cliente)</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.whatsappRaw || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Select value={selectedSlot} onValueChange={(v) => setSelectedSlot(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir horario" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map(s => (
                      <SelectItem key={s.startAt} value={s.startAt}>
                        {new Date(s.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                        {' — '}
                        {new Date(s.endAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                      </SelectItem>
                    ))}
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
    </div>
  )
}
