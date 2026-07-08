'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export type ClientRecord = {
  id: string
  firstName: string | null
  lastName: string | null
  whatsappRaw: string | null
  whatsappE164: string | null
  notes: string | null
  active: boolean
  createdAt: string
  consentData: boolean
  consentWhatsapp: boolean
}

type ClientForm = {
  firstName: string
  lastName: string
  whatsappRaw: string
  notes: string
  consentData: boolean
  consentWhatsapp: boolean
}

const emptyForm: ClientForm = {
  firstName: '',
  lastName: '',
  whatsappRaw: '',
  notes: '',
  consentData: false,
  consentWhatsapp: false,
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: ClientRecord | null
  onSaved?: (client: ClientRecord) => void
}) {
  const [form, setForm] = useState<ClientForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [initialConsent, setInitialConsent] = useState<{ consentData: boolean; consentWhatsapp: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    if (client) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        firstName: client.firstName ?? '',
        lastName: client.lastName ?? '',
        whatsappRaw: client.whatsappRaw ?? '',
        notes: client.notes ?? '',
        consentData: client.consentData,
        consentWhatsapp: client.consentWhatsapp,
      })
      setInitialConsent({ consentData: client.consentData, consentWhatsapp: client.consentWhatsapp })
    } else {
      setForm(emptyForm)
      setInitialConsent(null)
    }
  }, [open, client])

  async function handleSave() {
    setSaving(true)
    try {
      const url = client ? `/api/clients/${client.id}` : '/api/clients'
      const method = client ? 'PATCH' : 'POST'
      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        whatsappRaw: form.whatsappRaw,
        notes: form.notes,
      }
      if (!client) {
        payload.consentData = form.consentData
        payload.consentWhatsapp = form.consentWhatsapp
      } else {
        if (form.consentData !== initialConsent?.consentData) payload.consentData = form.consentData
        if (form.consentWhatsapp !== initialConsent?.consentWhatsapp) payload.consentWhatsapp = form.consentWhatsapp
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

      const saved = (await res.json()) as ClientRecord
      toast.success(client ? 'Cliente actualizado' : 'Cliente creado')
      onOpenChange(false)
      onSaved?.(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="clientFirstName">Nombre</FieldLabel>
              <Input
                id="clientFirstName"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="clientLastName">Apellido</FieldLabel>
              <Input
                id="clientLastName"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="clientWhatsapp">WhatsApp</FieldLabel>
            <Input
              id="clientWhatsapp"
              placeholder="+5491155556666 o 1155556666"
              value={form.whatsappRaw}
              onChange={(e) => setForm({ ...form, whatsappRaw: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="clientNotes">Notas</FieldLabel>
            <Textarea
              id="clientNotes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <Field orientation="horizontal" className="rounded-xl border border-border/70 bg-muted/45 p-3">
            <Checkbox
              id="clientConsentData"
              checked={form.consentData}
              onCheckedChange={(checked) => setForm({ ...form, consentData: checked })}
            />
            <FieldContent>
              <FieldLabel htmlFor="clientConsentData">Uso de datos personales</FieldLabel>
              <p className="text-xs text-muted-foreground">Registra la fecha del consentimiento.</p>
            </FieldContent>
          </Field>
          <Field orientation="horizontal" className="rounded-xl border border-border/70 bg-muted/45 p-3">
            <Checkbox
              id="clientConsentWhatsapp"
              checked={form.consentWhatsapp}
              onCheckedChange={(checked) => setForm({ ...form, consentWhatsapp: checked })}
            />
            <FieldContent>
              <FieldLabel htmlFor="clientConsentWhatsapp">Contacto por WhatsApp</FieldLabel>
              <p className="text-xs text-muted-foreground">Autoriza comunicaciones por este canal.</p>
            </FieldContent>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
