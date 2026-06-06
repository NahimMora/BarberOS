import { describe, expect, it } from 'vitest'
import { normalizePhone } from '@/lib/phone/normalize'

describe('normalizePhone', () => {
  it('normalizes an Argentine mobile number to E.164', () => {
    expect(normalizePhone('011 15-2345-6789')).toBe('+5491123456789')
  })

  it('keeps an E.164 Argentine mobile number normalized', () => {
    expect(normalizePhone('+5491123456789')).toBe('+5491123456789')
  })

  it('returns null for an invalid phone number', () => {
    expect(normalizePhone('123')).toBeNull()
  })
})
