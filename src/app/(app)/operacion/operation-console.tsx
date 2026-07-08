'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  Copy,
  FileUp,
  MapPin,
  Plus,
  Scissors,
  ShieldCheck,
  UserRoundCog,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/components/page-header'
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
import { MoneyInput } from '@/components/ui/money-input'
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
import { Skeleton } from '@/components/ui/skeleton'
import { summarizeSchedule } from '@/lib/staff/schedule-summary'

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
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type DayHours = { open: string; close: string } | null
type WorkingHours = Record<DayKey, DayHours>

const WORKING_HOURS_DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
]

const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { open: '09:00', close: '20:00' },
  tue: { open: '09:00', close: '20:00' },
  wed: { open: '09:00', close: '20:00' },
  thu: { open: '09:00', close: '20:00' },
  fri: { open: '09:00', close: '20:00' },
  sat: { open: '09:00', close: '20:00' },
  sun: null,
}

const ROLE_LABELS = {
  admin: 'Admin',
  receptionist: 'Recepción',
  barber: 'Barbero',
}

const ROLE_FILTERS: { value: 'all' | Staff['role']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'barber', label: 'Barberos' },
  { value: 'receptionist', label: 'Recepción' },
  { value: 'admin', label: 'Admins' },
]

const initialProfileForm = {
  fullName: '',
  email: '',
  password: '',
  role: 'receptionist' as Staff['role'],
  branchIds: [] as string[],
  commissionRate: '25.00',
  address: '',
  phone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  hireDate: '',
  relationshipType: '',
  medicalCertExpiry: '',
  documentationExpiry: '',
  internalNotes: '',
  displayColor: '#1f2937',
}

type ProfileForm = typeof initialProfileForm

export function OperationConsole() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [timeOff, setTimeOff] = useState<TimeOff[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('branches')
  const [staffRoleFilter, setStaffRoleFilter] = useState<'all' | Staff['role']>('all')

  const [branchOpen, setBranchOpen] = useState(false)
  const [staffOpen, setStaffOpen] = useState(false)
  const [serviceOpen, setServiceOpen] = useState(false)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profileDocuments, setProfileDocuments] = useState<BarberProfile['documents']>([])
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [disableTarget, setDisableTarget] = useState<Staff | null>(null)

  const [branchForm, setBranchForm] = useState(initialBranchForm)
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialProfileForm)
  const [serviceForm, setServiceForm] = useState({
    name: '',
    durationMinutes: '30',
    price: '',
  })
  const [timeOffForm, setTimeOffForm] = useState({
    barberId: '',
    branchId: '',
    startAt: '',
    endAt: '',
    reason: '',
  })

  const [availabilityBarberId, setAvailabilityBarberId] = useState('')
  const [availabilityBranchId, setAvailabilityBranchId] = useState('')
  const [addRangeDay, setAddRangeDay] = useState<number | null>(null)
  const [addRangeTimes, setAddRangeTimes] = useState({ startTime: '09:00', endTime: '18:00' })
  const [copySource, setCopySource] = useState<{ weekday: number; startTime: string; endTime: string } | null>(null)
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([])

  const barbers = useMemo(
    () => staff.filter((member) => member.role === 'barber' && member.status === 'active'),
    [staff],
  )

  const visibleStaff = useMemo(
    () => (staffRoleFilter === 'all' ? staff : staff.filter((member) => member.role === staffRoleFilter)),
    [staff, staffRoleFilter],
  )

  const selectedBarberId = availabilityBarberId || barbers[0]?.id || ''
  const selectedBranchId =
    availabilityBranchId || branches.find((branch) => branch.active)?.id || branches[0]?.id || ''

  const availabilitySchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) =>
          schedule.active &&
          schedule.barberId === selectedBarberId &&
          schedule.branchId === selectedBranchId,
      ),
    [schedules, selectedBarberId, selectedBranchId],
  )

  const schedulesByWeekday = useMemo(() => {
    const map = new Map<number, Schedule[]>()
    for (const schedule of availabilitySchedules) {
      const list = map.get(schedule.weekday) ?? []
      list.push(schedule)
      map.set(schedule.weekday, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [availabilitySchedules])

  const scheduleSummary = useMemo(
    () =>
      summarizeSchedule(
        availabilitySchedules.map((schedule) => ({
          weekday: schedule.weekday,
          startTime: schedule.startTime.slice(0, 5),
          endTime: schedule.endTime.slice(0, 5),
        })),
      ),
    [availabilitySchedules],
  )

  const visibleTimeOff = useMemo(
    () => timeOff.filter((row) => row.barberId === selectedBarberId),
    [timeOff, selectedBarberId],
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
      setHasLoaded(true)
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

  async function request(url: string, options: RequestInit) {
    const response = await fetch(url, options)
    const body = await response.json()
    if (!response.ok) {
      const message = typeof body.error === 'string' ? body.error : 'No se pudo completar la acción'
      throw new Error(message)
    }
    return body
  }

  async function mutate(url: string, options: RequestInit, successMessage: string) {
    const body = await request(url, options)
    toast.success(successMessage)
    await loadData()
    return body
  }

  async function saveBranch() {
    try {
      await mutate(editingBranchId ? `/api/branches/${editingBranchId}` : '/api/branches', {
        method: editingBranchId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchForm.name,
          address: branchForm.address,
          phone: branchForm.phone,
          timezone: 'America/Argentina/Buenos_Aires',
          workingHours: branchForm.workingHours,
        }),
      }, editingBranchId ? 'Sucursal actualizada' : 'Sucursal creada')
      setBranchOpen(false)
      setEditingBranchId(null)
      setBranchForm(initialBranchForm)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function openStaffDialog(member?: Staff) {
    setProfileFile(null)
    setProfileDocuments([])
    if (!member) {
      setEditingStaffId(null)
      setProfileForm(initialProfileForm)
      setStaffOpen(true)
      return
    }

    setEditingStaffId(member.id)
    setProfileForm({
      ...initialProfileForm,
      fullName: member.fullName,
      email: member.email,
      role: member.role,
      branchIds: member.branches.map((branch) => branch.id),
      commissionRate: member.commissionRate ?? '25.00',
    })
    setStaffOpen(true)

    if (member.role === 'barber') {
      const response = await fetch(`/api/barber-profiles/${member.id}`)
      if (!response.ok) {
        toast.error('No se pudo cargar el legajo')
        return
      }
      const data: BarberProfile = await response.json()
      setProfileForm((current) => ({
        ...current,
        address: data.address ?? '',
        phone: data.phone ?? '',
        emergencyContactName: data.emergencyContactName ?? '',
        emergencyContactPhone: data.emergencyContactPhone ?? '',
        hireDate: data.hireDate ?? '',
        relationshipType: data.relationshipType ?? '',
        medicalCertExpiry: data.medicalCertExpiry ?? '',
        documentationExpiry: data.documentationExpiry ?? '',
        internalNotes: data.internalNotes ?? '',
        displayColor: data.displayColor ?? '#1f2937',
      }))
      setProfileDocuments(data.documents)
    }
  }

  async function saveStaffProfile() {
    try {
      const staffBody = editingStaffId
        ? {
            fullName: profileForm.fullName,
            role: profileForm.role,
            branchIds: profileForm.role === 'admin' ? [] : profileForm.branchIds,
            commissionRate: profileForm.role === 'barber' ? profileForm.commissionRate : null,
          }
        : {
            fullName: profileForm.fullName,
            email: profileForm.email,
            password: profileForm.password,
            role: profileForm.role,
            branchIds: profileForm.role === 'admin' ? [] : profileForm.branchIds,
            commissionRate: profileForm.role === 'barber' ? profileForm.commissionRate : null,
          }

      const staffResult = await request(editingStaffId ? `/api/staff/${editingStaffId}` : '/api/staff', {
        method: editingStaffId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffBody),
      })
      const staffId = editingStaffId ?? staffResult.id

      if (profileForm.role === 'barber') {
        await request(`/api/barber-profiles/${staffId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: profileForm.address || null,
            phone: profileForm.phone || null,
            emergencyContactName: profileForm.emergencyContactName || null,
            emergencyContactPhone: profileForm.emergencyContactPhone || null,
            hireDate: profileForm.hireDate || null,
            relationshipType: profileForm.relationshipType || null,
            medicalCertExpiry: profileForm.medicalCertExpiry || null,
            documentationExpiry: profileForm.documentationExpiry || null,
            internalNotes: profileForm.internalNotes || null,
            displayColor: profileForm.displayColor || null,
          }),
        })

        if (profileFile) {
          const formData = new FormData()
          formData.set('file', profileFile)
          formData.set('entityType', 'barber_profile')
          formData.set('entityId', staffId)
          formData.set('fileCategory', 'barber_document')
          formData.set('visibility', 'admin_only')
          await request('/api/files', { method: 'POST', body: formData })
        }
      }

      toast.success(editingStaffId ? 'Persona actualizada' : 'Persona creada')
      await loadData()
      setStaffOpen(false)
      setEditingStaffId(null)
      setProfileForm(initialProfileForm)
      setProfileFile(null)
      setProfileDocuments([])
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

  async function confirmDisableStaff() {
    if (!disableTarget) return
    await toggleStaff(disableTarget)
    setDisableTarget(null)
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

  function openAddRange(weekday: number) {
    setAddRangeDay(weekday)
    setAddRangeTimes({ startTime: '09:00', endTime: '18:00' })
  }

  async function submitAddRange() {
    if (addRangeDay === null) return
    try {
      await mutate('/api/barber-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: selectedBarberId,
          branchId: selectedBranchId,
          weekday: addRangeDay,
          startTime: addRangeTimes.startTime,
          endTime: addRangeTimes.endTime,
        }),
      }, 'Horario agregado')
      setAddRangeDay(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  function openCopyDialog(range: Schedule) {
    setCopySource({ weekday: range.weekday, startTime: range.startTime.slice(0, 5), endTime: range.endTime.slice(0, 5) })
    setCopyTargetDays([])
  }

  async function copyScheduleToDays() {
    if (!copySource) return
    let succeeded = 0
    const failedDays: string[] = []
    for (const weekday of copyTargetDays) {
      try {
        await request('/api/barber-schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barberId: selectedBarberId,
            branchId: selectedBranchId,
            weekday,
            startTime: copySource.startTime,
            endTime: copySource.endTime,
          }),
        })
        succeeded += 1
      } catch {
        failedDays.push(DAY_SHORT[weekday])
      }
    }
    await loadData()
    if (succeeded > 0) toast.success(`Horario copiado a ${succeeded} día${succeeded === 1 ? '' : 's'}`)
    if (failedDays.length > 0) toast.error(`No se pudo copiar a: ${failedDays.join(', ')}`)
    setCopySource(null)
    setCopyTargetDays([])
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

  function editBranch(branch: Branch) {
    const hours = branch.workingHours
    setEditingBranchId(branch.id)
    setBranchForm({
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      workingHours: hours
        ? {
            mon: hours.mon ?? null,
            tue: hours.tue ?? null,
            wed: hours.wed ?? null,
            thu: hours.thu ?? null,
            fri: hours.fri ?? null,
            sat: hours.sat ?? null,
            sun: hours.sun ?? null,
          }
        : DEFAULT_WORKING_HOURS,
    })
    setBranchOpen(true)
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

  if (loading && !hasLoaded) {
    return (
      <div className="flex flex-col gap-4" aria-label="Cargando operación">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Configuración del negocio"
        title="Operación"
        description="Definí la estructura que alimenta la agenda, la caja y las comisiones: sucursales, personas, servicios y disponibilidad."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OperationStat label="Sucursales" value={branches.filter((branch) => branch.active).length} />
        <OperationStat label="Equipo activo" value={staff.filter((member) => member.status === 'active').length} />
        <OperationStat label="Servicios" value={services.filter((service) => service.active).length} />
        <OperationStat label="Horarios" value={schedules.filter((schedule) => schedule.active).length} />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab((value as string) ?? 'branches')}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto rounded-xl border border-border/70 bg-card px-2">
          <TabsTrigger value="branches"><MapPin data-icon="inline-start" />Sucursales</TabsTrigger>
          <TabsTrigger value="staff"><UserRoundCog data-icon="inline-start" />Equipo</TabsTrigger>
          <TabsTrigger value="services"><Scissors data-icon="inline-start" />Servicios</TabsTrigger>
          <TabsTrigger value="availability"><CalendarClock data-icon="inline-start" />Disponibilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="branches">
          <ResourceCard
            title="Sucursales"
            description="Los horarios definidos acá restringen la agenda."
            action={<Button size="sm" onClick={() => { setEditingBranchId(null); setBranchForm(initialBranchForm); setBranchOpen(true) }}><Plus data-icon="inline-start" />Nueva sucursal</Button>}
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
            action={<Button size="sm" onClick={() => void openStaffDialog()}><Plus data-icon="inline-start" />Nuevo usuario</Button>}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {ROLE_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={staffRoleFilter === filter.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStaffRoleFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Persona</TableHead><TableHead>Rol</TableHead><TableHead>Sucursales</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {visibleStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell><div className="font-medium">{member.fullName}</div><div className="text-xs text-muted-foreground">{member.email}</div></TableCell>
                    <TableCell>{ROLE_LABELS[member.role]}</TableCell>
                    <TableCell>{member.branches.map((branch) => branch.name).join(', ') || 'Todas'}</TableCell>
                    <TableCell><Badge variant={member.status === 'active' ? 'default' : 'secondary'}>{member.status === 'active' ? 'Activo' : 'Deshabilitado'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => void openStaffDialog(member)}>Editar</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => member.status === 'active' ? setDisableTarget(member) : void toggleStaff(member)}
                        >
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
              <CardHeader>
                <CardTitle>Horario recurrente</CardTitle>
                <CardDescription>Elegí un barbero y armá su semana día por día.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Barbero"
                    value={selectedBarberId}
                    items={barbers.map((barber) => ({ value: barber.id, label: barber.fullName }))}
                    onChange={setAvailabilityBarberId}
                  />
                  <SelectField
                    label="Sucursal"
                    value={selectedBranchId}
                    items={branches.filter((branch) => branch.active).map((branch) => ({ value: branch.id, label: branch.name }))}
                    onChange={setAvailabilityBranchId}
                  />
                </div>

                {barbers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay barberos activos todavía.</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {scheduleSummary.length > 0
                        ? `Resumen: ${scheduleSummary.join(' · ')}`
                        : 'Sin horario cargado para esta combinación de barbero y sucursal.'}
                    </p>

                    <div className="flex flex-col gap-2">
                      {WEEK_ORDER.map((weekday) => (
                        <div key={weekday} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="w-24 shrink-0 pt-1 text-sm font-medium">{DAY_NAMES[weekday]}</div>
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            {(schedulesByWeekday.get(weekday) ?? []).map((range) => (
                              <div key={range.id} className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pr-1.5 pl-3 text-xs">
                                <span className="font-mono tabular-nums">{range.startTime.slice(0, 5)}–{range.endTime.slice(0, 5)}</span>
                                <button
                                  type="button"
                                  onClick={() => openCopyDialog(range)}
                                  aria-label={`Copiar horario de ${DAY_NAMES[weekday]} a otros días`}
                                  title="Copiar a otros días"
                                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  <Copy className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void mutate(`/api/barber-schedules/${range.id}`, { method: 'DELETE' }, 'Horario quitado')}
                                  aria-label={`Quitar horario de ${DAY_NAMES[weekday]}`}
                                  title="Quitar"
                                  className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))}
                            <Button variant="outline" size="xs" onClick={() => openAddRange(weekday)}>
                              <Plus data-icon="inline-start" />Agregar rango
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Ausencias</CardTitle><CardDescription>Licencias, vacaciones y bloqueos extraordinarios.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TimeOffFields branches={branches} barbers={barbers} value={timeOffForm} onChange={setTimeOffForm} />
                <Button onClick={() => void createTimeOff()}>Registrar ausencia</Button>
                <div className="flex flex-col gap-2">
                  {visibleTimeOff.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin ausencias registradas para este barbero.</p>
                  ) : (
                    visibleTimeOff.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div><p className="font-medium">{row.barberName}</p><p className="text-xs text-muted-foreground">{new Date(row.startAt).toLocaleString('es-AR')} · {row.reason || 'Sin motivo'}</p></div>
                        <Button variant="ghost" size="sm" onClick={() => void mutate(`/api/barber-time-off?id=${row.id}`, { method: 'DELETE' }, 'Ausencia eliminada')}>Quitar</Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <BranchDialog editing={Boolean(editingBranchId)} open={branchOpen} onOpenChange={setBranchOpen} value={branchForm} onChange={setBranchForm} onSave={() => void saveBranch()} />
      <StaffProfileDialog
        editing={Boolean(editingStaffId)}
        open={staffOpen}
        onOpenChange={setStaffOpen}
        branches={branches}
        value={profileForm}
        onChange={setProfileForm}
        documents={profileDocuments}
        onFileChange={setProfileFile}
        onSave={() => void saveStaffProfile()}
      />
      <ServiceDialog editing={Boolean(editingServiceId)} open={serviceOpen} onOpenChange={setServiceOpen} value={serviceForm} onChange={setServiceForm} onSave={() => void saveService()} />

      <Dialog open={addRangeDay !== null} onOpenChange={(open) => !open && setAddRangeDay(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar rango · {addRangeDay !== null ? DAY_NAMES[addRangeDay] : ''}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde"><Input type="time" value={addRangeTimes.startTime} onChange={(event) => setAddRangeTimes({ ...addRangeTimes, startTime: event.target.value })} /></Field>
            <Field label="Hasta"><Input type="time" value={addRangeTimes.endTime} onChange={(event) => setAddRangeTimes({ ...addRangeTimes, endTime: event.target.value })} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddRangeDay(null)}>Cancelar</Button><Button onClick={() => void submitAddRange()}>Agregar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copySource !== null} onOpenChange={(open) => !open && setCopySource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Copiar {copySource ? `${copySource.startTime}–${copySource.endTime}` : ''} a otros días
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {copySource && WEEK_ORDER.filter((weekday) => weekday !== copySource.weekday).map((weekday) => {
              const checked = copyTargetDays.includes(weekday)
              return (
                <label key={weekday} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      setCopyTargetDays((current) =>
                        next ? [...current, weekday] : current.filter((day) => day !== weekday),
                      )
                    }
                  />
                  {DAY_NAMES[weekday]}
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopySource(null)}>Cancelar</Button>
            <Button disabled={copyTargetDays.length === 0} onClick={() => void copyScheduleToDays()}>Copiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(disableTarget)} onOpenChange={(open) => !open && setDisableTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deshabilitar a {disableTarget?.fullName}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Va a perder acceso al sistema hasta que lo vuelvas a habilitar. No se borra ningún dato histórico.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void confirmDisableStaff()}>Deshabilitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <CardContent><div className="overflow-x-auto">{children}</div></CardContent>
    </Card>
  )
}

function OperationStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 p-4 shadow-sm">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-primary">{value}</p>
    </div>
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
  function setDay(key: DayKey, hours: DayHours) {
    onChange({ ...value, workingHours: { ...value.workingHours, [key]: hours } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Nombre"><Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></Field>
          <Field label="Dirección"><Input value={value.address} onChange={(event) => onChange({ ...value, address: event.target.value })} /></Field>
          <Field label="Teléfono"><Input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} /></Field>
          <Field label="Horario por día">
            <div className="flex flex-col gap-2">
              {WORKING_HOURS_DAYS.map(({ key, label }) => {
                const dayHours = value.workingHours[key]
                const dayOpen = dayHours !== null
                return (
                  <div key={key} className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex w-32 shrink-0 items-center gap-2">
                      <Checkbox
                        id={`day-${key}`}
                        checked={dayOpen}
                        onCheckedChange={(checked) => setDay(key, checked ? { open: '09:00', close: '20:00' } : null)}
                      />
                      <Label htmlFor={`day-${key}`} className="text-sm font-medium">{label}</Label>
                    </div>
                    {dayOpen ? (
                      <div className="grid flex-1 grid-cols-2 gap-2">
                        <Input
                          type="time"
                          aria-label={`Apertura ${label}`}
                          value={dayHours.open}
                          onChange={(event) => setDay(key, { ...dayHours, open: event.target.value })}
                        />
                        <Input
                          type="time"
                          aria-label={`Cierre ${label}`}
                          value={dayHours.close}
                          onChange={(event) => setDay(key, { ...dayHours, close: event.target.value })}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Cerrado</p>
                    )}
                  </div>
                )
              })}
            </div>
          </Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave}>{editing ? 'Guardar' : 'Crear'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const initialBranchForm = { name: '', address: '', phone: '', workingHours: DEFAULT_WORKING_HOURS }

function StaffProfileDialog({ editing, open, onOpenChange, branches, value, onChange, documents, onFileChange, onSave }: {
  editing: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  branches: Branch[]
  value: ProfileForm
  onChange: (value: ProfileForm) => void
  documents: BarberProfile['documents']
  onFileChange: (file: File | null) => void
  onSave: () => void
}) {
  const isBarber = value.role === 'barber'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? 'Editar persona' : 'Nueva persona'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Datos básicos</p>
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
            {isBarber ? <Field label="Comisión %"><Input value={value.commissionRate} onChange={(event) => onChange({ ...value, commissionRate: event.target.value })} /></Field> : null}
          </div>

          {isBarber ? (
            <div className="flex flex-col gap-4 border-t pt-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Legajo</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dirección"><Input value={value.address} onChange={(event) => onChange({ ...value, address: event.target.value })} /></Field>
                <Field label="Teléfono"><Input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} /></Field>
                <Field label="Contacto de emergencia"><Input value={value.emergencyContactName} onChange={(event) => onChange({ ...value, emergencyContactName: event.target.value })} /></Field>
                <Field label="Teléfono de emergencia"><Input value={value.emergencyContactPhone} onChange={(event) => onChange({ ...value, emergencyContactPhone: event.target.value })} /></Field>
                <Field label="Fecha de ingreso"><Input type="date" value={value.hireDate} onChange={(event) => onChange({ ...value, hireDate: event.target.value })} /></Field>
                <SelectField
                  label="Vínculo"
                  value={value.relationshipType}
                  items={[
                    { value: 'empleado', label: 'Empleado' },
                    { value: 'socio', label: 'Socio' },
                    { value: 'monotributista', label: 'Monotributista' },
                    { value: 'colaborador', label: 'Colaborador' },
                  ]}
                  onChange={(relationshipType) => onChange({ ...value, relationshipType })}
                />
                <Field label="Vence certificado médico"><Input type="date" value={value.medicalCertExpiry} onChange={(event) => onChange({ ...value, medicalCertExpiry: event.target.value })} /></Field>
                <Field label="Vence documentación"><Input type="date" value={value.documentationExpiry} onChange={(event) => onChange({ ...value, documentationExpiry: event.target.value })} /></Field>
                <Field label="Color de agenda"><Input type="color" value={value.displayColor} onChange={(event) => onChange({ ...value, displayColor: event.target.value })} /></Field>
                <div className="sm:col-span-2"><Field label="Notas internas"><Textarea value={value.internalNotes} onChange={(event) => onChange({ ...value, internalNotes: event.target.value })} /></Field></div>
                <div className="sm:col-span-2">
                  <Field label="Documento privado">
                    <Input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
                  </Field>
                  {documents.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {documents.map((document) => (
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
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave}><ShieldCheck data-icon="inline-start" />{editing ? 'Guardar' : 'Crear persona'}</Button>
        </DialogFooter>
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
            <Field label="Precio"><MoneyInput value={value.price} onValueChange={(price) => onChange({ ...value, price })} /></Field>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave}>{editing ? 'Guardar' : 'Crear servicio'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
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
