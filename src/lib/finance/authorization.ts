import type { AppUser } from '@/lib/auth/get-session'
import { hasBranchAccess } from '@/lib/auth/authorization'

export function canManageCash(user: AppUser, branchId: string): boolean {
  return user.role !== 'barber' && hasBranchAccess(user, branchId)
}

export function canChargeSale(
  user: AppUser,
  branchId: string,
  barberId: string,
  allowBarberCharge: boolean,
): boolean {
  if (!hasBranchAccess(user, branchId)) return false
  if (user.role !== 'barber') return true
  return allowBarberCharge && user.id === barberId
}

export function canViewCommissions(user: AppUser, barberId: string): boolean {
  return user.role === 'admin' || (user.role === 'barber' && user.id === barberId)
}
