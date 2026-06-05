import { describe, it, expect } from 'vitest'

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
