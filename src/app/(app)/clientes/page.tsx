'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Search, Pencil } from 'lucide-react'

type Client = {
  id: string
  firstName: string | null
  lastName: string | null
  whatsappRaw: string | null
  whatsappE164: string | null
  notes: string | null
  active: boolean
  createdAt: string
}

type ClientForm = {
  firstName: string
  lastName: string
  whatsappRaw: string
  notes: string
  consentData: boolean
  consentWhatsapp: boolean
}

const empty: ClientForm = {
  firstName: '',
  lastName: '',
  whatsappRaw: '',
  notes: '',
  consentData: false,
  consentWhatsapp: false,
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientForm>(empty)
  const [saving, setSaving] = useState(false)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const qs = search ? `?q=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/clients${qs}`)
      if (!res.ok) throw new Error('Error al cargar clientes')
      const json = await res.json()
      setClients(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(fetchClients, 300)
    return () => clearTimeout(timer)
  }, [fetchClients])

  function openNew() {
    setEditing(null)
    setForm(empty)
    setDialogOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      whatsappRaw: c.whatsappRaw ?? '',
      notes: c.notes ?? '',
      consentData: false,
      consentWhatsapp: false,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const url = editing ? `/api/clients/${editing.id}` : '/api/clients'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (res.status === 409) {
        const json = await res.json()
        toast.error(json.error ?? 'Número de WhatsApp ya registrado')
        return
      }
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Error al guardar')
        return
      }

      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado')
      setDialogOpen(false)
      fetchClients()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o teléfono…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sin clientes
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                    </TableCell>
                    <TableCell>{c.whatsappE164 ?? c.whatsappRaw ?? '—'}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {c.notes ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.active ? 'default' : 'secondary'}>
                        {c.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="+5491155556666 o 1155556666"
                value={form.whatsappRaw}
                onChange={(e) => setForm({ ...form, whatsappRaw: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="consentData"
                checked={form.consentData}
                onChange={(e) => setForm({ ...form, consentData: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="consentData" className="cursor-pointer">
                Consiente el uso de datos personales
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="consentWhatsapp"
                checked={form.consentWhatsapp}
                onChange={(e) => setForm({ ...form, consentWhatsapp: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="consentWhatsapp" className="cursor-pointer">
                Consiente contacto por WhatsApp
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
