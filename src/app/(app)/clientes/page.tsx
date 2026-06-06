'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/page-header'
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
import { Pencil, Plus, Search, UserRoundSearch } from 'lucide-react'

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
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Relaciones"
        title="Clientes"
        description="Encontrá rápido a cada persona y mantené sus datos de contacto y consentimientos en orden."
        actions={(
          <Button onClick={openNew} size="lg" className="min-h-10">
            <Plus data-icon="inline-start" />
            Nuevo cliente
          </Button>
        )}
      />

      <Card className="paper-surface">
        <CardContent className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Directorio activo</p>
            <p className="text-xs text-muted-foreground">{clients.length} registros visibles</p>
          </div>
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Buscar clientes"
              placeholder="Buscar por nombre o teléfono..."
              className="bg-card pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-3" aria-label="Cargando clientes">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-18 rounded-2xl" />)}
        </div>
      ) : (
        <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm md:block">
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
                      <Button variant="ghost" size="icon" aria-label="Editar cliente" onClick={() => openEdit(c)}>
                        <Pencil />
                      </Button>
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
          {clients.length === 0 ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon"><UserRoundSearch /></EmptyMedia>
                <EmptyTitle>No encontramos clientes</EmptyTitle>
                <EmptyDescription>Probá otra búsqueda o registrá una nueva persona.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            clients.map((client) => (
              <Card key={client.id}>
                <CardContent className="flex items-start justify-between gap-4 py-1">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-xl font-semibold">
                      {[client.firstName, client.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {client.whatsappE164 ?? client.whatsappRaw ?? 'Sin teléfono'}
                    </p>
                    {client.notes ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{client.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <Badge variant={client.active ? 'default' : 'secondary'}>
                      {client.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Button variant="outline" size="icon" className="size-10" aria-label="Editar cliente" onClick={() => openEdit(client)}>
                      <Pencil />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="firstName">Nombre</FieldLabel>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="lastName">Apellido</FieldLabel>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel>
              <Input
                id="whatsapp"
                placeholder="+5491155556666 o 1155556666"
                value={form.whatsappRaw}
                onChange={(e) => setForm({ ...form, whatsappRaw: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <Field orientation="horizontal" className="rounded-xl border border-border/70 bg-muted/45 p-3">
              <Checkbox
                id="consentData"
                checked={form.consentData}
                onCheckedChange={(checked) => setForm({ ...form, consentData: checked })}
              />
              <FieldContent>
                <FieldLabel htmlFor="consentData">Uso de datos personales</FieldLabel>
                <p className="text-xs text-muted-foreground">Registra la fecha del consentimiento.</p>
              </FieldContent>
            </Field>
            <Field orientation="horizontal" className="rounded-xl border border-border/70 bg-muted/45 p-3">
              <Checkbox
                id="consentWhatsapp"
                checked={form.consentWhatsapp}
                onCheckedChange={(checked) => setForm({ ...form, consentWhatsapp: checked })}
              />
              <FieldContent>
                <FieldLabel htmlFor="consentWhatsapp">Contacto por WhatsApp</FieldLabel>
                <p className="text-xs text-muted-foreground">Autoriza comunicaciones por este canal.</p>
              </FieldContent>
            </Field>
          </FieldGroup>
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
