'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { ClientFormDialog, type ClientRecord } from '@/components/clients/client-form-dialog'
import { ClientCutHistory } from '@/components/clients/client-cut-history'
import { Copy, Pencil } from 'lucide-react'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function initials(client: ClientRecord | null): string {
  if (!client) return '?'
  const first = client.firstName?.trim()?.[0] ?? ''
  const last = client.lastName?.trim()?.[0] ?? ''
  const combined = `${first}${last}`.toUpperCase()
  return combined || '?'
}

export function ClientQuickViewSheet({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [client, setClient] = useState<ClientRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!open || !clientId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setClient(null)
    fetch(`/api/clients/${clientId}`)
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el cliente')
        return res.json() as Promise<ClientRecord>
      })
      .then((data) => setClient(data))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error'))
      .finally(() => setLoading(false))
  }, [open, clientId])

  const name = client
    ? [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Sin nombre'
    : ''
  const phone = client?.whatsappE164 ?? client?.whatsappRaw ?? null

  function copyPhone() {
    if (!phone) return
    void navigator.clipboard.writeText(phone)
    toast.success('Teléfono copiado')
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Ficha de cliente</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            {loading || !client ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="size-14 rounded-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>{initials(client)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg font-semibold">{name}</p>
                    <Badge variant={client.active ? 'default' : 'secondary'}>
                      {client.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-border/70 bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">WhatsApp</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm">{phone ?? 'Sin teléfono'}</p>
                    {phone ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Copiar teléfono"
                        onClick={copyPhone}
                      >
                        <Copy />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={client.consentData ? 'default' : 'outline'}>
                    {client.consentData ? 'Consentimiento de datos' : 'Sin consentimiento de datos'}
                  </Badge>
                  <Badge variant={client.consentWhatsapp ? 'default' : 'outline'}>
                    {client.consentWhatsapp ? 'Autoriza WhatsApp' : 'Sin autorización de WhatsApp'}
                  </Badge>
                </div>

                {(client.nickname || client.profession || client.birthdayDay || client.favoriteBranch) ? (
                  <div className="flex flex-col gap-1 rounded-xl border border-border/70 bg-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Datos extra</p>
                    <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                      {client.nickname ? <p>Apodo: {client.nickname}</p> : null}
                      {client.profession ? <p>Profesión: {client.profession}</p> : null}
                      {client.birthdayDay && client.birthdayMonth ? (
                        <p>Cumpleaños: {client.birthdayDay} de {MONTHS[client.birthdayMonth - 1]}</p>
                      ) : null}
                      {client.favoriteBranch ? <p>Sucursal donde más se corta: {client.favoriteBranch.name}</p> : null}
                    </div>
                  </div>
                ) : null}

                {client.notes ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Notas</p>
                    <p className="text-sm text-muted-foreground">{client.notes}</p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Historial de cortes</p>
                  <ClientCutHistory clientId={client.id} />
                </div>
              </>
            )}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={!client}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSaved={(updated) => setClient(updated)}
      />
    </>
  )
}
