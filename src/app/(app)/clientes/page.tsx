'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { ClientFormDialog, type ClientRecord } from '@/components/clients/client-form-dialog'
import { ClientQuickViewSheet } from '@/components/clients/client-quick-view-sheet'
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

type Client = ClientRecord

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [quickViewClientId, setQuickViewClientId] = useState<string | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)

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
    setDialogOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setDialogOpen(true)
  }

  function openQuickView(id: string) {
    setQuickViewClientId(id)
    setQuickViewOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Relaciones"
        title="Clientes"
        actions={(
          <Button onClick={openNew} size="lg" className="min-h-10">
            <Plus data-icon="inline-start" />
            Nuevo cliente
          </Button>
        )}
      />

      <Card>
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
                      <button
                        type="button"
                        onClick={() => openQuickView(c.id)}
                        className="text-left hover:underline"
                      >
                        {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                      </button>
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
                  <button
                    type="button"
                    onClick={() => openQuickView(client.id)}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate font-heading text-xl font-semibold hover:underline">
                      {[client.firstName, client.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {client.whatsappE164 ?? client.whatsappRaw ?? 'Sin teléfono'}
                    </p>
                    {client.notes ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{client.notes}</p> : null}
                  </button>
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

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editing}
        onSaved={() => fetchClients()}
      />

      <ClientQuickViewSheet
        clientId={quickViewClientId}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />
    </div>
  )
}
