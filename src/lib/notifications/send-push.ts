import webpush from 'web-push'
import { and, eq } from 'drizzle-orm'
import { pushSubscriptions } from '@/db/schema'
import { db } from '@/lib/db'
import { recordSystemEvent } from '@/lib/audit/record-system-event'

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Envía un push a todas las suscripciones activas de un usuario. Fire-and-
 * forget respecto al que la llama: nunca tira, solo loguea en
 * system_events — un fallo de push no puede romper la respuesta de un
 * endpoint de turnos.
 */
export async function notifyUser(
  organizationId: string,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return

  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.organizationId, organizationId),
        eq(pushSubscriptions.userId, userId),
      ))

    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.authKey },
          },
          JSON.stringify(payload),
        )
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number }
        if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id))
          return
        }
        await recordSystemEvent({
          level: 'warn',
          source: 'notifications.send-push',
          message: 'Fallo al enviar notificación push',
          organizationId,
          context: { userId, statusCode: pushErr.statusCode ?? null },
        })
      }
    }))
  } catch {
    // No propagar — el push nunca debe romper el flujo que lo dispara.
  }
}
