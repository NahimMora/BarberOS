import { parsePhoneNumberWithError } from 'libphonenumber-js/core'
import metadata from 'libphonenumber-js/metadata.max'

export function normalizePhone(raw: string): string | null {
  if (!raw || !raw.trim()) return null
  try {
    const phone = parsePhoneNumberWithError(raw, 'AR', metadata)
    return phone.isValid() ? phone.number : null
  } catch {
    return null
  }
}
