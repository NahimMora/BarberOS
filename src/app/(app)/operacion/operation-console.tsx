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
import { rangesOverlap } from '@/lib/staff/schedule-summary'

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

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

type ScheduleBlock = {
  key: string
  branchId: string
  branchName: string
  weekdays: number[]
  dayLabel: string
  ranges: { startTime: string; endTime: string }[]
  rangeLabel: string
  scheduleIds: string[]
}

/**
 * Collapses a barber's schedule rows into readable blocks, grouping
 * consecutive days (Lun→Dom) that share the exact same ranges, e.g.
 * "Lun–Vie 09:00–13:00, 14:00–19:00" — mirrors summarizeSchedule's
 * grouping but keeps the source row ids so a block can be edited/deleted.
 */
function buildBarberBlocks(schedules: Schedule[], branches: Branch[]): ScheduleBlock[] {
  const branchName = (id: string) => branches.find((branch) => branch.id === id)?.name ?? 'Sucursal'
  const byBranch = new Map<string, Schedule[]>()
  for (const schedule of schedules) {
    const list = byBranch.get(schedule.branchId) ?? []
    list.push(schedule)
    byBranch.set(schedule.branchId, list)
  }

  const blocks: ScheduleBlock[] = []
  for (const [branchId, branchSchedules] of byBranch) {
    const byWeekday = new Map<number, Schedule[]>()
    for (const schedule of branchSchedules) {
      const list = byWeekday.get(schedule.weekday) ?? []
      list.push(schedule)
      byWeekday.set(schedule.weekday, list)
    }

    const labelByWeekday = new Map<number, string>()
    const idsByWeekday = new Map<number, string[]>()
    const rangesByWeekday = new Map<number, { startTime: string; endTime: string }[]>()
    for (const [weekday, ranges] of byWeekday) {
      const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime))
      labelByWeekday.set(
        weekday,
        sorted.map((range) => `${range.startTime.slice(0, 5)}–${range.endTime.slice(0, 5)}`).join(', '),
      )
      idsByWeekday.set(weekday, sorted.map((range) => range.id))
      rangesByWeekday.set(
        weekday,
        sorted.map((range) => ({ startTime: range.startTime.slice(0, 5), endTime: range.endTime.slice(0, 5) })),
      )
    }

    let index = 0
    while (index < WEEK_ORDER.length) {
      const weekday = WEEK_ORDER[index]
      const label = labelByWeekday.get(weekday)
      if (!label) {
        index += 1
        continue
      }
      let end = index
      while (end + 1 < WEEK_ORDER.length && labelByWeekday.get(WEEK_ORDER[end + 1]) === label) {
        end += 1
      }
      const days = WEEK_ORDER.slice(index, end + 1)
      const startDay = DAY_SHORT[weekday]
      const endDay = DAY_SHORT[WEEK_ORDER[end]]
      blocks.push({
        key: `${branchId}-${weekday}-${end}`,
        branchId,
        branchName: branchName(branchId),
        weekdays: days,
        dayLabel: days.length === 1 ? startDay : `${startDay}–${endDay}`,
        ranges: rangesByWeekday.get(weekday) ?? [],
        rangeLabel: label,
        scheduleIds: days.flatMap((day) => idsByWeekday.get(day) ?? []),
      })
      index = end + 1
    }
  }
  return blocks
}

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
  const [blockDays, setBlockDays] = useState<number[]>([])
  const [blockStart, setBlockStart] = useState('09:00')
  const [blockEnd, setBlockEnd] = useState('18:00')
  const [blockError, setBlockError] = useState<string | null>(null)
  const [blockSaving, setBlockSaving] = useState(false)
  const [editingBlockKey, setEditingBlockKey] = useState<string | null>(null)

  const barbers = useMemo(
    () => staff.filter((member) => member.role === 'barber' && member.status === 'active'),
    [staff],
  )

  const visibleStaff = useMemo(
    () => (staffRoleFilter === 'all' ? staff : staff.filter((member) => member.role === staffRoleFilter)),
    [staff, staffRoleFilter],
  )

  const selectedBarberId = availabilityBarberId || barbers[0]?.id || ''
  const selectedBarber = useMemo(
    () => barbers.find((barber) => barber.id === selectedBarberId),
    [barbers, selectedBarberId],
  )
  const barberBranchOptions = useMemo(() => {
    const ids = new Set((selectedBarber?.branches ?? []).map((branch) => branch.id))
    return branches.filter((branch) => ids.has(branch.id))
  }, [selectedBarber, branches])
  const selectedBranchId =
    availabilityBranchId && barberBranchOptions.some((branch) => branch.id === availabilityBranchId)
      ? availabilityBranchId
      : barberBranchOptions.find((branch) => branch.active)?.id ?? barberBranchOptions[0]?.id ?? ''

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

  const barberAllSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.active && schedule.barberId === selectedBarberId),
    [schedules, selectedBarberId],
  )
  const scheduleBlocks = useMemo(
    () => buildBarberBlocks(barberAllSchedules, branches),
    [barberAllSchedules, branches],
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

  function resetBlockComposer() {
    setBlockDays([])
    setBlockStart('09:00')
    setBlockEnd('18:00')
    setBlockError(null)
    setEditingBlockKey(null)
  }

  function toggleBlockDay(weekday: number) {
    setBlockDays((current) =>
      current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday],
    )
    setBlockError(null)
  }

  function startEditBlock(block: ScheduleBlock) {
    if (block.ranges.length !== 1) return
    setBlockDays(block.weekdays)
    setBlockStart(block.ranges[0].startTime)
    setBlockEnd(block.ranges[0].endTime)
    setEditingBlockKey(block.key)
    setBlockError(null)
  }

  async function deleteBlock(block: ScheduleBlock) {
    try {
      for (const id of block.scheduleIds) {
        await request(`/api/barber-schedules/${id}`, { method: 'DELETE' })
      }
      toast.success('Horario quitado')
      await loadData()
      if (editingBlockKey === block.key) resetBlockComposer()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function submitBlock() {
    setBlockError(null)
    if (blockDays.length === 0) {
      setBlockError('Elegí al menos un día.')
      return
    }
    if (blockStart >= blockEnd) {
      setBlockError('El horario de inicio debe ser anterior al de cierre.')
      return
    }

    const editingIds = new Set(
      editingBlockKey ? scheduleBlocks.find((block) => block.key === editingBlockKey)?.scheduleIds ?? [] : [],
    )
    const relevant = availabilitySchedules.filter((schedule) => !editingIds.has(schedule.id))
    for (const weekday of blockDays) {
      const sameDay = relevant.filter((schedule) => schedule.weekday === weekday)
      const duplicate = sameDay.find(
        (schedule) => schedule.startTime.slice(0, 5) === blockStart && schedule.endTime.slice(0, 5) === blockEnd,
      )
      if (duplicate) {
        setBlockError('Ya existe un horario igual para estos días.')
        return
      }
      const overlapping = sameDay.find((schedule) =>
        rangesOverlap(
          { startTime: blockStart, endTime: blockEnd },
          { startTime: schedule.startTime.slice(0, 5), endTime: schedule.endTime.slice(0, 5) },
        ),
      )
      if (overlapping) {
        const branchLabel = branches.find((branch) => branch.id === selectedBranchId)?.name ?? 'esta sucursal'
        setBlockError(
          `Este horario se superpone con ${DAY_SHORT[weekday]} ${overlapping.startTime.slice(0, 5)}–${overlapping.endTime.slice(0, 5)} en ${branchLabel}.`,
        )
        return
      }
    }

    setBlockSaving(true)
    try {
      if (editingBlockKey) {
        const block = scheduleBlocks.find((current) => current.key === editingBlockKey)
        if (block) {
          for (const id of block.scheduleIds) {
            await request(`/api/barber-schedules/${id}`, { method: 'DELETE' })
          }
        }
      }
      let succeeded = 0
      const failedDays: string[] = []
      for (const weekday of blockDays) {
        try {
          await request('/api/barber-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              barberId: selectedBarberId,
              branchId: selectedBranchId,
              weekday,
              startTime: blockStart,
              endTime: blockEnd,
            }),
          })
          succeeded += 1
        } catch {
          failedDays.push(DAY_SHORT[weekday])
        }
      }
      await loadData()
      if (succeeded > 0) {
        toast.success(editingBlockKey ? 'Horario actualizado' : `Horario aplicado a ${succeeded} día${succeeded === 1 ? '' : 's'}`)
      }
      if (failedDays.length > 0) {
        setBlockError(`No se pudo aplicar a: ${failedDays.join(', ')}.`)
      } else {
        resetBlockComposer()
      }
    } finally {
      setBlockSaving(false)
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
                <CardDescription>Elegí los días y el horario, y aplicalo de una vez.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Barbero"
                    value={selectedBarberId}
                    items={barbers.map((barber) => ({ value: barber.id, label: barber.fullName }))}
                    onChange={(value) => { setAvailabilityBarberId(value); setAvailabilityBranchId(''); resetBlockComposer() }}
                  />
                  <SelectField
                    label="Sucursal"
                    value={selectedBranchId}
                    items={barberBranchOptions.map((branch) => ({ value: branch.id, label: branch.name }))}
                    onChange={(value) => { setAvailabilityBranchId(value); resetBlockComposer() }}
                  />
                </div>

                {barbers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay barberos activos todavía.</p>
                ) : barberBranchOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Este barbero no tiene sucursales asignadas.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {WEEK_ORDER.map((weekday) => (
                          <Button
                            key={weekday}
                            type="button"
                            variant={blockDays.includes(weekday) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleBlockDay(weekday)}
                          >
                            {DAY_SHORT[weekday]}
                          </Button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Desde">
                          <Input
                            type="time"
                            value={blockStart}
                            onChange={(event) => { setBlockStart(event.target.value); setBlockError(null) }}
                          />
                        </Field>
                        <Field label="Hasta">
                          <Input
                            type="time"
                            value={blockEnd}
                            onChange={(event) => { setBlockEnd(event.target.value); setBlockError(null) }}
                          />
                        </Field>
                      </div>
                      {blockError ? <p className="text-sm text-destructive">{blockError}</p> : null}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={blockSaving} onClick={() => void submitBlock()}>
                          <Plus data-icon="inline-start" />
                          {blockSaving ? 'Guardando…' : editingBlockKey ? 'Guardar cambios' : 'Aplicar a días seleccionados'}
                        </Button>
                        {editingBlockKey ? (
                          <Button size="sm" variant="ghost" onClick={resetBlockComposer}>Cancelar edición</Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {scheduleBlocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin horario cargado para este barbero.</p>
                      ) : (
                        scheduleBlocks.map((block) => (
                          <div
                            key={block.key}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                          >
                            <p className="text-sm">
                              <span className="font-medium">{block.dayLabel}</span>
                              {' · '}
                              <span className="font-mono tabular-nums">{block.rangeLabel}</span>
                              {' · '}
                              <span className="text-muted-foreground">{block.branchName}</span>
                            </p>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={block.ranges.length !== 1}
                                onClick={() => startEditBlock(block)}
                              >
                                Editar
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => void deleteBlock(block)}>
                                Quitar
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
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
