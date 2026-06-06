import type { AppUser } from './get-session'

export function hasBranchAccess(user: AppUser, branchId: string): boolean {
  return user.role === 'admin' || user.branchIds.includes(branchId)
}

export function canAccessAppointment(
  user: AppUser,
  branchId: string,
  barberId: string,
): boolean {
  if (!hasBranchAccess(user, branchId)) return false
  return user.role !== 'barber' || user.id === barberId
}

export function canCreateAppointment(
  user: AppUser,
  branchId: string,
  barberId: string,
): boolean {
  return canAccessAppointment(user, branchId, barberId)
}
