import { describe, expect, it } from 'vitest'
import type { AppUser } from '@/lib/auth/get-session'
import { canChargeSale, canManageCash, canViewCommissions } from './authorization'

const baseUser: AppUser = {
  id: 'user-1',
  authId: 'auth-1',
  organizationId: 'org-1',
  role: 'receptionist',
  status: 'active',
  fullName: 'Persona Demo',
  email: 'demo@example.com',
  branchIds: ['branch-1'],
}

describe('finance authorization', () => {
  it('allows admins to operate cash and charge any barber', () => {
    const admin = { ...baseUser, role: 'admin' as const, branchIds: [] }
    expect(canManageCash(admin, 'branch-2')).toBe(true)
    expect(canChargeSale(admin, 'branch-2', 'barber-2', false)).toBe(true)
  })

  it('scopes receptionists to their assigned branches', () => {
    expect(canManageCash(baseUser, 'branch-1')).toBe(true)
    expect(canManageCash(baseUser, 'branch-2')).toBe(false)
    expect(canChargeSale(baseUser, 'branch-1', 'barber-2', false)).toBe(true)
    expect(canChargeSale(baseUser, 'branch-2', 'barber-2', true)).toBe(false)
  })

  it('only lets barbers charge their own work when enabled', () => {
    const barber = { ...baseUser, id: 'barber-1', role: 'barber' as const }
    expect(canManageCash(barber, 'branch-1')).toBe(false)
    expect(canChargeSale(barber, 'branch-1', 'barber-1', true)).toBe(true)
    expect(canChargeSale(barber, 'branch-1', 'barber-1', false)).toBe(false)
    expect(canChargeSale(barber, 'branch-1', 'barber-2', true)).toBe(false)
  })

  it('limits commission reports to admins and the owning barber', () => {
    const admin = { ...baseUser, role: 'admin' as const }
    const barber = { ...baseUser, id: 'barber-1', role: 'barber' as const }
    expect(canViewCommissions(admin, 'barber-2')).toBe(true)
    expect(canViewCommissions(barber, 'barber-1')).toBe(true)
    expect(canViewCommissions(barber, 'barber-2')).toBe(false)
    expect(canViewCommissions(baseUser, 'barber-1')).toBe(false)
  })
})
