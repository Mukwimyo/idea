self.__ideaActiveRooms = self.__ideaActiveRooms || new Map()

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
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clientList => {
      const targetPath = new URL(targetUrl, self.location.origin).pathname
      const roomId = data.roomId || targetPath.match(/\/room\/([^/]+)/)?.[1]
      const roomIsVisibleByClient = clientList.some(client => {
        const clientPath = new URL(client.url).pathname
        return (client.visibilityState === 'visible' || client.focused) && clientPath === targetPath
      })
      const roomIsRecentlyActive = roomId ? [...self.__ideaActiveRooms.values()].some(room => room.roomId === roomId && room.visible && Date.now() - room.updatedAt < 15000) : false
      const roomIsVisibleByReply = roomId
        ? await Promise.all(
            clientList.map(
              client =>
                new Promise(resolve => {
                  const channel = new MessageChannel()
                  const timeout = setTimeout(() => resolve(false), 250)
                  channel.port1.onmessage = reply => {
                    clearTimeout(timeout)
                    resolve(reply.data?.roomId === roomId && reply.data?.visible === true)
                  }
                  client.postMessage({ type: 'IDEA_CHECK_ACTIVE_ROOM', roomId }, [channel.port2])
                })
            )
          ).then(results => results.some(Boolean))
        : false

      if (roomIsVisibleByClient || roomIsRecentlyActive || roomIsVisibleByReply) return
      return self.registration.showNotification(data.title || '이데아', options)
    })
  )
})

self.addEventListener('message', event => {
  if (event.data?.type !== 'IDEA_ACTIVE_ROOM' || !event.source?.id) return
  if (!event.data.roomId || !event.data.visible) {
    self.__ideaActiveRooms.delete(event.source.id)
    return
  }
  self.__ideaActiveRooms.set(event.source.id, {
    roomId: event.data.roomId,
    visible: true,
    updatedAt: Date.now(),
  })
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
