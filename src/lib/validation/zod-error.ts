import type { z } from 'zod'

export function zodErrorMessage(error: z.ZodError, fallback = 'Datos inválidos'): string {
  const { formErrors, fieldErrors } = error.flatten()
  const messages = [...formErrors, ...Object.values(fieldErrors).flatMap((msgs) => msgs ?? [])]
  return messages.length > 0 ? messages.join(' ') : fallback
}
