import { type AppUser } from './get-session'

type Role = AppUser['role']

export function requireRole(user: AppUser, allowed: Role[]): void {
  if (!allowed.includes(user.role)) {
    throw new Error('FORBIDDEN')
  }
}
