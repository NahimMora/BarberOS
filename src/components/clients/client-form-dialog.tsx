'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Prefijo de celular argentino fijo — el campo solo pide lo que sigue
// (código de área + número), no hace falta que el usuario tipee el +549
// cada vez.
const PHONE_PREFIX = '+549'

function stripPhonePrefix(value: string): string {
  return value.startsWith(PHONE_PREFIX) ? value.slice(PHONE_PREFIX.length) : value
}

export type ClientRecord = {
  id: string
  firstName: string | null
  lastName: string | null
  nickname: string | null
  birthdayDay: number | null
  birthdayMonth: number | null
  profession: string | null
  whatsappRaw: string | null
  whatsappE164: string | null
  notes: string | null
  active: boolean
  createdAt: string
  consentData: boolean
  consentWhatsapp: boolean
  favoriteBranch?: { id: string; name: string } | null
}

type ClientForm = {
  firstName: string
  lastName: string
  nickname: string
  birthdayDay: string
  birthdayMonth: string
  profession: string
  whatsappRaw: string
  noPhone: boolean
  notes: string
  consentData: boolean
  consentWhatsapp: boolean
}

const emptyForm: ClientForm = {
  firstName: '',
  lastName: '',
  nickname: '',
  birthdayDay: '',
  birthdayMonth: '',
  profession: '',
  whatsappRaw: '',
  noPhone: false,
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
        nickname: client.nickname ?? '',
        birthdayDay: client.birthdayDay ? String(client.birthdayDay) : '',
        birthdayMonth: client.birthdayMonth ? String(client.birthdayMonth) : '',
        profession: client.profession ?? '',
        whatsappRaw: client.whatsappRaw ?? '',
        noPhone: !client.whatsappRaw,
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
        nickname: form.nickname,
        birthdayDay: form.birthdayDay ? Number(form.birthdayDay) : null,
        birthdayMonth: form.birthdayMonth ? Number(form.birthdayMonth) : null,
        profession: form.profession,
        whatsappRaw: form.noPhone ? '' : form.whatsappRaw,
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
            {form.noPhone ? (
              <p className="rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Sin celular — pedir en el próximo turno
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-md border border-border/70 bg-muted/45 px-2.5 py-2 text-sm text-muted-foreground">
                  {PHONE_PREFIX}
                </span>
                <Input
                  id="clientWhatsapp"
                  placeholder="11 5555 6666"
                  inputMode="numeric"
                  value={stripPhonePrefix(form.whatsappRaw)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    setForm({ ...form, whatsappRaw: digits ? `${PHONE_PREFIX}${digits}` : '' })
                  }}
                />
              </div>
            )}
          </Field>
          <Field orientation="horizontal" className="rounded-xl border border-border/70 bg-muted/45 p-3">
            <Checkbox
              id="clientNoPhone"
              checked={form.noPhone}
              onCheckedChange={(checked) => setForm({ ...form, noPhone: checked, whatsappRaw: checked ? '' : form.whatsappRaw })}
            />
            <FieldContent>
              <FieldLabel htmlFor="clientNoPhone">No tiene celular</FieldLabel>
              <p className="text-xs text-muted-foreground">Se puede completar en un próximo turno.</p>
            </FieldContent>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="clientNickname">Apodo</FieldLabel>
              <Input
                id="clientNickname"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="clientProfession">Profesión</FieldLabel>
              <Input
                id="clientProfession"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="clientBirthdayDay">Día de cumpleaños</FieldLabel>
              <Input
                id="clientBirthdayDay"
                type="number"
                min={1}
                max={31}
                value={form.birthdayDay}
                onChange={(e) => setForm({ ...form, birthdayDay: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="clientBirthdayMonth">Mes de cumpleaños</FieldLabel>
              <Select
                value={form.birthdayMonth}
                onValueChange={(value) => setForm({ ...form, birthdayMonth: value ?? '' })}
              >
                <SelectTrigger id="clientBirthdayMonth" className="w-full">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((label, index) => (
                    <SelectItem key={label} value={String(index + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
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
