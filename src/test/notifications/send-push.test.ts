import 'dotenv/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendNotification = vi.fn()
const setVapidDetails = vi.fn()
vi.mock('web-push', () => ({
  default: { setVapidDetails, sendNotification },
}))

const deleteWhere = vi.fn(() => Promise.resolve())
const selectWhere = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => selectWhere() }) }),
    delete: () => ({ where: deleteWhere }),
  },
}))

const recordSystemEvent = vi.fn(() => Promise.resolve())
vi.mock('@/lib/audit/record-system-event', () => ({
  recordSystemEvent,
}))

const SUBSCRIPTION = {
  id: 'sub-1',
  organizationId: 'org-1',
  userId: 'user-1',
  endpoint: 'https://push.example.com/abc',
  p256dh: 'p256dh-key',
  authKey: 'auth-key',
}

describe('notifyUser', () => {
  beforeEach(() => {
    sendNotification.mockReset()
    deleteWhere.mockClear()
    recordSystemEvent.mockClear()
    selectWhere.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('sends a push to every subscription for the user', async () => {
    selectWhere.mockResolvedValue([SUBSCRIPTION])
    sendNotification.mockResolvedValue(undefined)

    const { notifyUser } = await import('@/lib/notifications/send-push')
    await notifyUser('org-1', 'user-1', { title: 'Nuevo turno', body: 'Hoy 10:00hs' })

    expect(sendNotification).toHaveBeenCalledTimes(1)
    const [target, payload] = sendNotification.mock.calls[0]
    expect(target).toEqual({
      endpoint: SUBSCRIPTION.endpoint,
      keys: { p256dh: SUBSCRIPTION.p256dh, auth: SUBSCRIPTION.authKey },
    })
    expect(JSON.parse(payload)).toEqual({ title: 'Nuevo turno', body: 'Hoy 10:00hs' })
  })

  it('deletes the subscription when the push service reports it is gone (410)', async () => {
    selectWhere.mockResolvedValue([SUBSCRIPTION])
    sendNotification.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 }))

    const { notifyUser } = await import('@/lib/notifications/send-push')
    await notifyUser('org-1', 'user-1', { title: 'Turno cancelado', body: 'x' })

    expect(deleteWhere).toHaveBeenCalledTimes(1)
    expect(recordSystemEvent).not.toHaveBeenCalled()
  })

  it('logs a system event instead of throwing on unexpected send failures', async () => {
    selectWhere.mockResolvedValue([SUBSCRIPTION])
    sendNotification.mockRejectedValue(Object.assign(new Error('Server error'), { statusCode: 500 }))

    const { notifyUser } = await import('@/lib/notifications/send-push')
    await expect(notifyUser('org-1', 'user-1', { title: 'x', body: 'y' })).resolves.toBeUndefined()

    expect(recordSystemEvent).toHaveBeenCalledTimes(1)
    expect(deleteWhere).not.toHaveBeenCalled()
  })

  it('does nothing when there are no subscriptions', async () => {
    selectWhere.mockResolvedValue([])

    const { notifyUser } = await import('@/lib/notifications/send-push')
    await notifyUser('org-1', 'user-1', { title: 'x', body: 'y' })

    expect(sendNotification).not.toHaveBeenCalled()
  })
})
