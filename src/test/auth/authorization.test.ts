import { describe, expect, it } from 'vitest'
import {
  canAccessAppointment,
  canCreateAppointment,
  hasBranchAccess,
} from '@/lib/auth/authorization'
import type { AppUser } from '@/lib/auth/get-session'

function makeUser(overrides: Partial<AppUser>): AppUser {
  return {
    id: 'user-1',
    authId: 'auth-1',
    organizationId: 'org-1',
    role: 'receptionist',
    status: 'active',
    fullName: 'Demo User',
    email: 'demo@example.com',
    branchIds: ['branch-1'],
    ...overrides,
  }
}

describe('branch authorization', () => {
  it('allows admins to access any branch in their organization', () => {
    expect(hasBranchAccess(makeUser({ role: 'admin', branchIds: [] }), 'branch-2')).toBe(true)
  })

  it('limits receptionists to assigned branches', () => {
    const user = makeUser({ role: 'receptionist' })
    expect(hasBranchAccess(user, 'branch-1')).toBe(true)
    expect(hasBranchAccess(user, 'branch-2')).toBe(false)
  })
})

describe('appointment authorization', () => {
  it('allows a barber to manage only their own appointment in an assigned branch', () => {
    const barber = makeUser({ id: 'barber-1', role: 'barber' })
    expect(canAccessAppointment(barber, 'branch-1', 'barber-1')).toBe(true)
    expect(canAccessAppointment(barber, 'branch-1', 'barber-2')).toBe(false)
    expect(canAccessAppointment(barber, 'branch-2', 'barber-1')).toBe(false)
  })

  it('prevents a barber from creating an appointment for another barber', () => {
    const barber = makeUser({ id: 'barber-1', role: 'barber' })
    expect(canCreateAppointment(barber, 'branch-1', 'barber-1')).toBe(true)
    expect(canCreateAppointment(barber, 'branch-1', 'barber-2')).toBe(false)
  })
})
