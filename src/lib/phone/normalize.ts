import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'

export function normalizePhone(raw: string): string | null {
  if (!raw || !raw.trim()) return null
  try {
    if (!isValidPhoneNumber(raw, 'AR')) return null
    const phone = parsePhoneNumber(raw, 'AR')
    return phone.format('E.164')
  } catch {
    return null
  }
}
