'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  FileUp,
  MapPin,
  Plus,
  Scissors,
  ShieldCheck,
  UserRoundCog,
} from 'lucide-react'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type Branch = {
  id: string
  name: string
  address: string | null
  phone: string | null
  timezone: string | null
  workingHours: Record<string, { open: string; close: string } | null> | null
  active: boolean
}

type Staff = {
  id: string
  fullName: string
  email: string
  role: 'admin' | 'receptionist' | 'barber'
  status: 'active' | 'invited' | 'disabled'
  commissionRate: string | null
  branches: { id: string; name: string }[]
}

type Service = {
  id: string
  name: string
  durationMinutes: number
  price: string
  active: boolean
}

type Schedule = {
  id: string
  barberId: string
  barberName: string
  branchId: string
  weekday: number
  startTime: string
  endTime: string
  active: boolean
}

type TimeOff = {
  id: string
  barberId: string
  barberName: string
  branchId: string | null
  startAt: string
  endAt: string
  reason: string | null
}

type BarberProfile = {
  userId: string
  fullName: string
  address: string | null
  phone: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  hireDate: string | null
  relationshipType: string | null
  commissionRate: string | null
  medicalCertExpiry: string | null
  documentationExpiry: string | null
  internalNotes: string | null
  displayColor: string | null
  documents: {
    id: string
    originalFilename: string
    fileCategory: string
  }[]
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const ROLE_LABELS = {
  admin: 'Admin',
  receptionist: 'Recepción',
  barber: 'Barbero',
}

const initialStaffForm = {
  fullName: '',
  email: '',
  password: '',
  role: 'receptionist' as Staff['role'],
  branchIds: [] as string[],
  commissionRate: '25.00',
}

export function OperationConsole() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [timeOff, setTimeOff] = useState<TimeOff[]>([])
  const [loading, setLoading] = useState(true)

  const [branchOpen, setBranchOpen] = useState(false)
  const [staffOpen, setStaffOpen] = useState(false)
  const [serviceOpen, setServiceOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<BarberProfile | null>(null)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)

  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    phone: '',
    open: '09:00',
    close: '20:00',
  })
  const [staffForm, setStaffForm] = useState(initialStaffForm)
  const [serviceForm, setServiceForm] = useState({
    name: '',
    durationMinutes: '30',
    price: '',
  })
  const [scheduleForm, setScheduleForm] = useState({
    barberId: '',
    branchId: '',
    weekday: '1',
    startTime: '09:00',
    endTime: '18:00',
  })
  const [timeOffForm, setTimeOffForm] = useState({
    barberId: '',
    branchId: '',
    startAt: '',
    endAt: '',
    reason: '',
  })

  const barbers = useMemo(
    () => staff.filter((member) => member.role === 'barber' && member.status === 'active'),
    [staff],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const responses = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/staff'),
        fetch('/api/services'),
        fetch('/api/barber-schedules'),
        fetch('/api/barber-time-off'),
      ])
      if (responses.some((response) => !response.ok)) {
        throw new Error('No se pudo cargar la configuración operativa')
      }
      const [branchRows, staffRows, serviceRows, scheduleRows, timeOffRows] =
        await Promise.all(responses.map((response) => response.json()))
      setBranches(branchRows)
      setStaff(staffRows)
      setServices(serviceRows)
      setSchedules(scheduleRows)
      setTimeOff(timeOffRows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  async function mutate(url: string, options: RequestInit, successMessage: string) {
    const response = await fetch(url, options)
    const body = await response.json()
    if (!response.ok) {
      const message = typeof body.error === 'string' ? body.error : 'No se pudo completar la acción'
      throw new Error(message)
    }
    toast.success(successMessage)
    await loadData()
    return body
  }

  async function saveBranch() {
    const workingHours = {
      mon: { open: branchForm.open, close: branchForm.close },
      tue: { open: branchForm.open, close: branchForm.close },
      wed: { open: branchForm.open, close: branchForm.close },
      thu: { open: branchForm.open, close: branchForm.close },
      fri: { open: branchForm.open, close: branchForm.close },
      sat: { open: branchForm.open, close: branchForm.close },
      sun: null,
    }
    try {
      await mutate(editingBranchId ? `/api/branches/${editingBranchId}` : '/api/branches', {
        method: editingBranchId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchForm.name,
          address: branchForm.address,
          phone: branchForm.phone,
          timezone: 'America/Argentina/Buenos_Aires',
          workingHours,
        }),
      }, editingBranchId ? 'Sucursal actualizada' : 'Sucursal creada')
      setBranchOpen(false)
      setEditingBranchId(null)
      setBranchForm({ name: '', address: '', phone: '', open: '09:00', close: '20:00' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function saveStaff() {
    try {
      const body = editingStaffId
        ? {
            fullName: staffForm.fullName,
            role: staffForm.role,
            branchIds: staffForm.role === 'admin' ? [] : staffForm.branchIds,
            commissionRate: staffForm.role === 'barber' ? staffForm.commissionRate : null,
          }
        : staffForm
      await mutate(editingStaffId ? `/api/staff/${editingStaffId}` : '/api/staff', {
        method: editingStaffId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, editingStaffId ? 'Usuario actualizado' : 'Usuario creado')
      setStaffOpen(false)
      setEditingStaffId(null)
      setStaffForm(initialStaffForm)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function toggleStaff(member: Staff) {
    try {
      await mutate(`/api/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: member.status === 'active' ? 'disabled' : 'active',
        }),
      }, member.status === 'active' ? 'Usuario deshabilitado' : 'Usuario habilitado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function saveService() {
    try {
      await mutate(editingServiceId ? `/api/services/${editingServiceId}` : '/api/services', {
        method: editingServiceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serviceForm.name,
          durationMinutes: Number(serviceForm.durationMinutes),
          price: serviceForm.price,
        }),
      }, editingServiceId ? 'Servicio actualizado' : 'Servicio creado')
      setServiceOpen(false)
      setEditingServiceId(null)
      setServiceForm({ name: '', durationMinutes: '30', price: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function toggleService(service: Service) {
    try {
      await mutate(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !service.active }),
      }, service.active ? 'Servicio desactivado' : 'Servicio activado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function createSchedule() {
    try {
      await mutate('/api/barber-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scheduleForm,
          weekday: Number(scheduleForm.weekday),
        }),
      }, 'Horario agregado')
      setScheduleForm((current) => ({ ...current, weekday: '1' }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function createTimeOff() {
    try {
      await mutate('/api/barber-time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...timeOffForm,
          branchId: timeOffForm.branchId || null,
          startAt: new Date(timeOffForm.startAt).toISOString(),
          endAt: new Date(timeOffForm.endAt).toISOString(),
        }),
      }, 'Ausencia registrada')
      setTimeOffForm((current) => ({ ...current, startAt: '', endAt: '', reason: '' }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function openProfile(userId: string) {
    const response = await fetch(`/api/barber-profiles/${userId}`)
    if (!response.ok) {
      toast.error('No se pudo cargar el legajo')
      return
    }
    setProfile(await response.json())
    setProfileFile(null)
    setProfileOpen(true)
  }

  function editBranch(branch: Branch) {
    const monday = branch.workingHours?.mon
    setEditingBranchId(branch.id)
    setBranchForm({
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      open: monday?.open ?? '09:00',
      close: monday?.close ?? '20:00',
    })
    setBranchOpen(true)
  }

  function editStaff(member: Staff) {
    setEditingStaffId(member.id)
    setStaffForm({
      fullName: member.fullName,
      email: member.email,
      password: '',
      role: member.role,
      branchIds: member.branches.map((branch) => branch.id),
      commissionRate: member.commissionRate ?? '25.00',
    })
    setStaffOpen(true)
  }

  function editService(service: Service) {
    setEditingServiceId(service.id)
    setServiceForm({
      name: service.name,
      durationMinutes: String(service.durationMinutes),
      price: service.price,
    })
    setServiceOpen(true)
  }

  async function saveProfile() {
    if (!profile) return
    try {
      await mutate(`/api/barber-profiles/${profile.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: profile.address,
          phone: profile.phone,
          emergencyContactName: profile.emergencyContactName,
          emergencyContactPhone: profile.emergencyContactPhone,
          hireDate: profile.hireDate,
          relationshipType: profile.relationshipType,
          commissionRate: profile.commissionRate,
          medicalCertExpiry: profile.medicalCertExpiry,
          documentationExpiry: profile.documentationExpiry,
          internalNotes: profile.internalNotes,
          displayColor: profile.displayColor,
        }),
      }, 'Legajo actualizado')

      if (profileFile) {
        const formData = new FormData()
        formData.set('file', profileFile)
        formData.set('entityType', 'barber_profile')
        formData.set('entityId', profile.userId)
        formData.set('fileCategory', 'barber_document')
        formData.set('visibility', 'admin_only')
        await mutate('/api/files', { method: 'POST', body: formData }, 'Documento adjuntado')
      }
      setProfileOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando operación...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Configuración del negocio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Operación</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Sucursales, equipo, servicios y disponibilidad que alimentan la agenda.
        </p>
      </header>

      <Tabs defaultValue="branches">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="branches"><MapPin data-icon="inline-start" />Sucursales</TabsTrigger>
          <TabsTrigger value="staff"><UserRoundCog data-icon="inline-start" />Equipo</TabsTrigger>
          <TabsTrigger value="services"><Scissors data-icon="inline-start" />Servicios</TabsTrigger>
          <TabsTrigger value="availability"><CalendarClock data-icon="inline-start" />Disponibilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="branches">
          <ResourceCard
            title="Sucursales"
            description="Los horarios definidos acá restringen la agenda."
            action={<Button size="sm" onClick={() => { setEditingBranchId(null); setBranchForm({ name: '', address: '', phone: '', open: '09:00', close: '20:00' }); setBranchOpen(true) }}><Plus data-icon="inline-start" />Nueva sucursal</Button>}
          >
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Dirección</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.address || 'Sin dirección'}</TableCell>
                    <TableCell><Badge variant={branch.active ? 'default' : 'secondary'}>{branch.active ? 'Activa' : 'Inactiva'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => editBranch(branch)}>Editar</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!branch.active}
                          onClick={() => void mutate(`/api/branches/${branch.id}`, { method: 'DELETE' }, 'Sucursal desactivada')}
                        >
                          Desactivar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResourceCard>
        </TabsContent>

        <TabsContent value="staff">
          <ResourceCard
            title="Equipo"
            description="Roles y alcance por sucursal, autorizados también en backend."
            action={<Button size="sm" onClick={() => { setEditingStaffId(null); setStaffForm(initialStaffForm); setStaffOpen(true) }}><Plus data-icon="inline-start" />Nuevo usuario</Button>}
          >
            <Table>
              <TableHeader><TableRow><TableHead>Persona</TableHead><TableHead>Rol</TableHead><TableHead>Sucursales</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell><div className="font-medium">{member.fullName}</div><div className="text-xs text-muted-foreground">{member.email}</div></TableCell>
                    <TableCell>{ROLE_LABELS[member.role]}</TableCell>
                    <TableCell>{member.branches.map((branch) => branch.name).join(', ') || 'Todas'}</TableCell>
                    <TableCell><Badge variant={member.status === 'active' ? 'default' : 'secondary'}>{member.status === 'active' ? 'Activo' : 'Deshabilitado'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {member.role === 'barber' ? <Button variant="outline" size="sm" onClick={() => void openProfile(member.id)}>Legajo</Button> : null}
                        <Button variant="outline" size="sm" onClick={() => editStaff(member)}>Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => void toggleStaff(member)}>
                          {member.status === 'active' ? 'Deshabilitar' : 'Habilitar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResourceCard>
        </TabsContent>

        <TabsContent value="services">
          <ResourceCard
            title="Servicios"
            description="La duración define el turno y el precio alimenta la venta."
            action={<Button size="sm" onClick={() => { setEditingServiceId(null); setServiceForm({ name: '', durationMinutes: '30', price: '' }); setServiceOpen(true) }}><Plus data-icon="inline-start" />Nuevo servicio</Button>}
          >
            <Table>
              <TableHeader><TableRow><TableHead>Servicio</TableHead><TableHead>Duración</TableHead><TableHead>Precio</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>{service.durationMinutes} min</TableCell>
                    <TableCell>${service.price}</TableCell>
                    <TableCell><Badge variant={service.active ? 'default' : 'secondary'}>{service.active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => editService(service)}>Editar</Button><Button variant="ghost" size="sm" onClick={() => void toggleService(service)}>{service.active ? 'Desactivar' : 'Activar'}</Button></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResourceCard>
        </TabsContent>

        <TabsContent value="availability">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Horario recurrente</CardTitle><CardDescription>Bloques semanales disponibles para reservar.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ScheduleFields
                  branches={branches}
                  barbers={barbers}
                  value={scheduleForm}
                  onChange={setScheduleForm}
                />
                <Button onClick={() => void createSchedule()}>Agregar horario</Button>
                <div className="flex flex-col gap-2">
                  {schedules.filter((row) => row.active).map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div><p className="font-medium">{row.barberName}</p><p className="text-xs text-muted-foreground">{DAY_NAMES[row.weekday]} · {row.startTime.slice(0, 5)} a {row.endTime.slice(0, 5)}</p></div>
                      <Button variant="ghost" size="sm" onClick={() => void mutate(`/api/barber-schedules/${row.id}`, { method: 'DELETE' }, 'Horario desactivado')}>Quitar</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Ausencias</CardTitle><CardDescription>Licencias, vacaciones y bloqueos extraordinarios.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TimeOffFields branches={branches} barbers={barbers} value={timeOffForm} onChange={setTimeOffForm} />
                <Button onClick={() => void createTimeOff()}>Registrar ausencia</Button>
                <div className="flex flex-col gap-2">
                  {timeOff.map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div><p className="font-medium">{row.barberName}</p><p className="text-xs text-muted-foreground">{new Date(row.startAt).toLocaleString('es-AR')} · {row.reason || 'Sin motivo'}</p></div>
                      <Button variant="ghost" size="sm" onClick={() => void mutate(`/api/barber-time-off?id=${row.id}`, { method: 'DELETE' }, 'Ausencia eliminada')}>Quitar</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <BranchDialog editing={Boolean(editingBranchId)} open={branchOpen} onOpenChange={setBranchOpen} value={branchForm} onChange={setBranchForm} onSave={() => void saveBranch()} />
      <StaffDialog editing={Boolean(editingStaffId)} open={staffOpen} onOpenChange={setStaffOpen} branches={branches} value={staffForm} onChange={setStaffForm} onSave={() => void saveStaff()} />
      <ServiceDialog editing={Boolean(editingServiceId)} open={serviceOpen} onOpenChange={setServiceOpen} value={serviceForm} onChange={setServiceForm} onSave={() => void saveService()} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} profile={profile} onChange={setProfile} onFileChange={setProfileFile} onSave={() => void saveProfile()} />
    </div>
  )
}

function ResourceCard({ title, description, action, children }: {
  title: string
  description: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex flex-col gap-1"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function BranchDialog({ editing, open, onOpenChange, value, onChange, onSave }: {
  editing: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  value: typeof initialBranchForm
  onChange: (value: typeof initialBranchForm) => void
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Nombre"><Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></Field>
          <Field label="Dirección"><Input value={value.address} onChange={(event) => onChange({ ...value, address: event.target.value })} /></Field>
          <Field label="Teléfono"><Input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Apertura"><Input type="time" value={value.open} onChange={(event) => onChange({ ...value, open: event.target.value })} /></Field>
            <Field label="Cierre"><Input type="time" value={value.close} onChange={(event) => onChange({ ...value, close: event.target.value })} /></Field>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave}>{editing ? 'Guardar' : 'Crear'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const initialBranchForm = { name: '', address: '', phone: '', open: '09:00', close: '20:00' }

function StaffDialog({ editing, open, onOpenChange, branches, value, onChange, onSave }: {
  editing: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  branches: Branch[]
  value: typeof initialStaffForm
  onChange: (value: typeof initialStaffForm) => void
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Nombre completo"><Input value={value.fullName} onChange={(event) => onChange({ ...value, fullName: event.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={value.email} disabled={editing} onChange={(event) => onChange({ ...value, email: event.target.value })} /></Field>
          {!editing ? <Field label="Contraseña inicial"><Input type="password" value={value.password} onChange={(event) => onChange({ ...value, password: event.target.value })} /></Field> : null}
          <Field label="Rol">
            <Select
              items={Object.entries(ROLE_LABELS).map(([key, label]) => ({ value: key, label }))}
              value={value.role}
              onValueChange={(role) => onChange({ ...value, role: (role ?? 'receptionist') as Staff['role'] })}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>{Object.entries(ROLE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
          {value.role !== 'admin' ? (
            <Field label="Sucursales">
              <div className="flex flex-wrap gap-2">
                {branches.map((branch) => {
                  const selected = value.branchIds.includes(branch.id)
                  return (
                    <Button
                      key={branch.id}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onChange({
                        ...value,
                        branchIds: selected
                          ? value.branchIds.filter((id) => id !== branch.id)
                          : [...value.branchIds, branch.id],
                      })}
                    >
                      {branch.name}
                    </Button>
                  )
                })}
              </div>
            </Field>
          ) : null}
          {value.role === 'barber' ? <Field label="Comisión %"><Input value={value.commissionRate} onChange={(event) => onChange({ ...value, commissionRate: event.target.value })} /></Field> : null}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave}>{editing ? 'Guardar' : 'Crear usuario'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ServiceDialog({ editing, open, onOpenChange, value, onChange, onSave }: {
  editing: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  value: { name: string; durationMinutes: string; price: string }
  onChange: (value: { name: string; durationMinutes: string; price: string }) => void
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Nombre"><Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duración (min)"><Input type="number" min="5" value={value.durationMinutes} onChange={(event) => onChange({ ...value, durationMinutes: event.target.value })} /></Field>
            <Field label="Precio"><Input inputMode="decimal" value={value.price} onChange={(event) => onChange({ ...value, price: event.target.value })} /></Field>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave}>{editing ? 'Guardar' : 'Crear servicio'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScheduleFields({ branches, barbers, value, onChange }: {
  branches: Branch[]
  barbers: Staff[]
  value: { barberId: string; branchId: string; weekday: string; startTime: string; endTime: string }
  onChange: (value: { barberId: string; branchId: string; weekday: string; startTime: string; endTime: string }) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField label="Barbero" value={value.barberId} items={barbers.map((barber) => ({ value: barber.id, label: barber.fullName }))} onChange={(barberId) => onChange({ ...value, barberId })} />
      <SelectField label="Sucursal" value={value.branchId} items={branches.map((branch) => ({ value: branch.id, label: branch.name }))} onChange={(branchId) => onChange({ ...value, branchId })} />
      <SelectField label="Día" value={value.weekday} items={DAY_NAMES.map((label, index) => ({ value: String(index), label }))} onChange={(weekday) => onChange({ ...value, weekday })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Desde"><Input type="time" value={value.startTime} onChange={(event) => onChange({ ...value, startTime: event.target.value })} /></Field>
        <Field label="Hasta"><Input type="time" value={value.endTime} onChange={(event) => onChange({ ...value, endTime: event.target.value })} /></Field>
      </div>
    </div>
  )
}

function TimeOffFields({ branches, barbers, value, onChange }: {
  branches: Branch[]
  barbers: Staff[]
  value: { barberId: string; branchId: string; startAt: string; endAt: string; reason: string }
  onChange: (value: { barberId: string; branchId: string; startAt: string; endAt: string; reason: string }) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField label="Barbero" value={value.barberId} items={barbers.map((barber) => ({ value: barber.id, label: barber.fullName }))} onChange={(barberId) => onChange({ ...value, barberId })} />
      <SelectField label="Sucursal" value={value.branchId} items={branches.map((branch) => ({ value: branch.id, label: branch.name }))} onChange={(branchId) => onChange({ ...value, branchId })} />
      <Field label="Desde"><Input type="datetime-local" value={value.startAt} onChange={(event) => onChange({ ...value, startAt: event.target.value })} /></Field>
      <Field label="Hasta"><Input type="datetime-local" value={value.endAt} onChange={(event) => onChange({ ...value, endAt: event.target.value })} /></Field>
      <div className="sm:col-span-2"><Field label="Motivo"><Input value={value.reason} onChange={(event) => onChange({ ...value, reason: event.target.value })} /></Field></div>
    </div>
  )
}

function ProfileDialog({ open, onOpenChange, profile, onChange, onFileChange, onSave }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: BarberProfile | null
  onChange: (profile: BarberProfile | null) => void
  onFileChange: (file: File | null) => void
  onSave: () => void
}) {
  if (!profile) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Legajo · {profile.fullName}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dirección"><Input value={profile.address ?? ''} onChange={(event) => onChange({ ...profile, address: event.target.value })} /></Field>
          <Field label="Teléfono"><Input value={profile.phone ?? ''} onChange={(event) => onChange({ ...profile, phone: event.target.value })} /></Field>
          <Field label="Contacto de emergencia"><Input value={profile.emergencyContactName ?? ''} onChange={(event) => onChange({ ...profile, emergencyContactName: event.target.value })} /></Field>
          <Field label="Teléfono de emergencia"><Input value={profile.emergencyContactPhone ?? ''} onChange={(event) => onChange({ ...profile, emergencyContactPhone: event.target.value })} /></Field>
          <Field label="Fecha de ingreso"><Input type="date" value={profile.hireDate ?? ''} onChange={(event) => onChange({ ...profile, hireDate: event.target.value || null })} /></Field>
          <SelectField
            label="Vínculo"
            value={profile.relationshipType ?? ''}
            items={[
              { value: 'empleado', label: 'Empleado' },
              { value: 'socio', label: 'Socio' },
              { value: 'monotributista', label: 'Monotributista' },
              { value: 'colaborador', label: 'Colaborador' },
            ]}
            onChange={(relationshipType) => onChange({ ...profile, relationshipType })}
          />
          <Field label="Comisión %"><Input value={profile.commissionRate ?? ''} onChange={(event) => onChange({ ...profile, commissionRate: event.target.value || null })} /></Field>
          <Field label="Vence certificado médico"><Input type="date" value={profile.medicalCertExpiry ?? ''} onChange={(event) => onChange({ ...profile, medicalCertExpiry: event.target.value || null })} /></Field>
          <Field label="Vence documentación"><Input type="date" value={profile.documentationExpiry ?? ''} onChange={(event) => onChange({ ...profile, documentationExpiry: event.target.value || null })} /></Field>
          <Field label="Color de agenda"><Input type="color" value={profile.displayColor ?? '#1f2937'} onChange={(event) => onChange({ ...profile, displayColor: event.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Notas internas"><Textarea value={profile.internalNotes ?? ''} onChange={(event) => onChange({ ...profile, internalNotes: event.target.value })} /></Field></div>
          <div className="sm:col-span-2">
            <Field label="Documento privado">
              <Input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
            </Field>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.documents.map((document) => (
                <Button
                  key={document.id}
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={`/api/files/${document.id}/download`} target="_blank" rel="noreferrer" />}
                >
                  <FileUp data-icon="inline-start" />{document.originalFilename}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave}><ShieldCheck data-icon="inline-start" />Guardar legajo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label>{label}</Label>{children}</div>
}

function SelectField({ label, value, items, onChange }: {
  label: string
  value: string
  items: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <Select items={items} value={value} onValueChange={(next) => onChange(next ?? '')}>
        <SelectTrigger className="w-full"><SelectValue placeholder={`Seleccionar ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent><SelectGroup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </Field>
  )
}
