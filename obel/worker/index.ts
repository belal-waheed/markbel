/// <reference lib="webworker" />

const swSelf = self as any

// ─── Notification Click Handler ──────────────────────────────────
swSelf.addEventListener('notificationclick', (event: any) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    swSelf.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen })
          return
        }
      }
      return swSelf.clients.openWindow(urlToOpen)
    })
  )
})

// ─── Push event (handles wake-up push notification messages) ──────
swSelf.addEventListener('push', (event: any) => {
  try {
    let data = {}
    if (event.data) {
      try {
        data = event.data.json()
      } catch {
        data = { body: event.data.text() }
      }
    }
    
    const title = (data as any).title || 'Obel'
    const options = {
      icon: '/obel.png',
      badge: '/obel.png',
      vibrate: [200, 100, 200],
      ...data,
      data: { url: (data as any).data?.url || (data as any).url || '/' },
    } as NotificationOptions

    event.waitUntil(swSelf.registration.showNotification(title, options))
  } catch (err) {
    console.error('[ServiceWorker] Push event error:', err)
    event.waitUntil(swSelf.registration.showNotification('Obel Notification', {
      body: 'A notification is waiting for you',
      icon: '/obel.png',
    }))
  }
})
