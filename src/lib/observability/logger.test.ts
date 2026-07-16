import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('emits a JSON line with level, message and timestamp', () => {
    logger.info('turno creado', { organizationId: 'org-1' })
    const entry = JSON.parse(logSpy.mock.calls[0][0])
    expect(entry).toMatchObject({ level: 'info', message: 'turno creado', organizationId: 'org-1' })
    expect(typeof entry.timestamp).toBe('string')
  })

  it('routes error() to console.error', () => {
    logger.error('fallo inesperado')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('redacts sensitive keys in a flat context', () => {
    logger.info('login attempt', { email: 'a@b.com', password: 'hunter2' })
    const entry = JSON.parse(logSpy.mock.calls[0][0])
    expect(entry.password).toBe('[REDACTED]')
    expect(entry.email).toBe('a@b.com')
  })

  it('redacts sensitive keys nested inside objects and arrays', () => {
    logger.info('payload', {
      user: { authToken: 'abc123', name: 'Barbero' },
      items: [{ secret: 'shh' }],
    })
    const entry = JSON.parse(logSpy.mock.calls[0][0])
    expect(entry.user.authToken).toBe('[REDACTED]')
    expect(entry.user.name).toBe('Barbero')
    expect(entry.items[0].secret).toBe('[REDACTED]')
  })

  it('serializes an Error safely instead of throwing', () => {
    expect(() => logger.error('unhandled', { error: new Error('boom') })).not.toThrow()
    const entry = JSON.parse(errorSpy.mock.calls[0][0])
    expect(entry.error).toMatchObject({ name: 'Error', message: 'boom' })
  })
})
