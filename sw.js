self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  const targetUrl = data.url || '/idea/'

  const options = {
    body: data.body || '',
    icon: '/idea/icon-192.png',
    badge: '/idea/icon-192.png',
    data: { url: targetUrl },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false,
    renotify: true,
    tag: 'idea-message',
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const targetPath = new URL(targetUrl, self.location.origin).pathname
      const roomIsVisible = clientList.some(client => {
        const clientPath = new URL(client.url).pathname
        return client.visibilityState === 'visible' && clientPath === targetPath
      })

      if (roomIsVisible) return
      return self.registration.showNotification(data.title || '이데아', options)
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/idea/'

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
