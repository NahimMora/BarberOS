import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Lightweight smoke test: verifies the middleware module exports correctly
// Full middleware behavior requires integration testing with a running Supabase instance

describe('middleware module', () => {
  it('exports a middleware function and config', async () => {
    // Dynamic import to avoid initializing Supabase during test
    const mod = await import('./middleware')
    expect(typeof mod.middleware).toBe('function')
    expect(mod.config).toBeDefined()
    expect(mod.config.matcher).toBeDefined()
  })
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}))

describe('middleware correlation id', () => {
  it('sets a x-request-id response header on a public route', async () => {
    const { middleware } = await import('./middleware')
    const response = await middleware(new NextRequest('http://localhost/login'))
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  it('preserves an incoming x-request-id instead of generating a new one', async () => {
    const { middleware } = await import('./middleware')
    const response = await middleware(
      new NextRequest('http://localhost/login', {
        headers: { 'x-request-id': 'incoming-id' },
      }),
    )
    expect(response.headers.get('x-request-id')).toBe('incoming-id')
  })

  it('sets a x-request-id header on the login redirect for a protected route', async () => {
    const { middleware } = await import('./middleware')
    const response = await middleware(new NextRequest('http://localhost/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })
})
