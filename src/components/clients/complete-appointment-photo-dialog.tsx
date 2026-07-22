'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// Aparece opcionalmente después de marcar un turno como completado — carga
// la foto del corte terminado al historial del cliente (client_visit_photos,
// R2). Nunca bloquea el flujo de completar el turno: "Omitir" siempre cierra
// sin error.
export function CompleteAppointmentPhotoDialog({
  open,
  onOpenChange,
  clientId,
  branchId,
  appointmentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  branchId: string
  appointmentId: string
}) {
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setCaption('')
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('branchId', branchId)
      formData.append('appointmentId', appointmentId)
      if (caption.trim()) formData.append('caption', caption.trim())

      const res = await fetch(`/api/clients/${clientId}/photos`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Error al subir la foto')
        return
      }
      toast.success('Foto agregada al historial')
      reset()
      onOpenChange(false)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Foto del corte (opcional)</DialogTitle>
          <DialogDescription>
            Se guarda en el historial de cortes del cliente. Podés omitir este paso.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="cutPhotoFile">Foto</FieldLabel>
            <input
              id="cutPhotoFile"
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cutPhotoCaption">Comentario (opcional)</FieldLabel>
            <Textarea
              id="cutPhotoCaption"
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
            Omitir
          </Button>
          <Button onClick={() => void handleUpload()} disabled={!file || uploading}>
            {uploading ? 'Subiendo…' : 'Guardar foto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
