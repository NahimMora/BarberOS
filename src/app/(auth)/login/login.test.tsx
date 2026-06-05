import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoginPage from './page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
  })

  it('renders submit button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument()
  })

  it('renders BarberOS title', () => {
    render(<LoginPage />)
    expect(screen.getByText('BarberOS')).toBeInTheDocument()
  })
})
