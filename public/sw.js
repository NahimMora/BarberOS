// Service worker mínimo para notificaciones push. No cachea nada — el
// único trabajo acá es mostrar la notificación y llevar al usuario a la
// URL correcta al hacer click. No pasa por el build de Next.js.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }

  const { title, body, url, tag } = payload
  event.waitUntil(
    self.registration.showNotification(title || 'BarberOS', {
      body,
      tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: url || '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.length > 0 && 'focus' in clients[0]) {
        clients[0].navigate(targetUrl)
        return clients[0].focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
