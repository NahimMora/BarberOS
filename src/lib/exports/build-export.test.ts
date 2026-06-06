import { describe, expect, it } from 'vitest'
import { canExportResource, exportResources } from './build-export'

describe('canExportResource', () => {
  it('allows administrators to export every supported resource', () => {
    for (const resource of exportResources) {
      expect(canExportResource('admin', resource)).toBe(true)
    }
  })

  it('limits receptionists to sales, cash and clients', () => {
    expect(canExportResource('receptionist', 'sales')).toBe(true)
    expect(canExportResource('receptionist', 'cash')).toBe(true)
    expect(canExportResource('receptionist', 'clients')).toBe(true)
    expect(canExportResource('receptionist', 'commissions')).toBe(false)
    expect(canExportResource('receptionist', 'audit')).toBe(false)
  })

  it('does not allow barbers to export operational data', () => {
    for (const resource of exportResources) {
      expect(canExportResource('barber', resource)).toBe(false)
    }
  })
})
