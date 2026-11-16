const CACHE = 'one-tap-safar-v16-telemetry-buttons-fixed'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['/', '/manifest.webmanifest', '/logo.svg']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => {
        console.log('[SW] Purging outdated cache:', key)
        return caches.delete(key)
      }))
    )
  )
  self.clients.claim()
})

// Allow instant skip-waiting on broadcast message
self.addEventListener('message', event => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', event => {
  // Never intercept non-GET or cross-origin or /api/ requests
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) return

  // Network-first with no-cache for navigation requests so updates show up immediately
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE).then(cache => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
    )
    return
  }

  // Network-first for CSS/JS scripts to guarantee immediate mobile styling updates
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse.status === 200) {
            const copy = networkResponse.clone()
            caches.open(CACHE).then(cache => cache.put(event.request, copy))
          }
          return networkResponse
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Cache-first for images, fonts, and media
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse.status === 200) {
          const copy = networkResponse.clone()
          caches.open(CACHE).then(cache => cache.put(event.request, copy))
        }
        return networkResponse
      }).catch(() => null)

      return cachedResponse || fetchPromise
    })
  )
})

// Handle PWA notification click on mobile devices
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

// Handle Web Push event (if push service configured)
self.addEventListener('push', event => {
  if (!event.data) return
  try {
    const data = event.data.json()
    const title = data.title || 'One Tap Production Update'
    const options = {
      body: data.body || 'Production stages updated.',
      icon: '/logo.svg',
      badge: '/logo.svg',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      tag: data.tag || `onetap-push-${Date.now()}`
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    const text = event.data.text()
    event.waitUntil(
      self.registration.showNotification('One Tap Production Update', {
        body: text,
        icon: '/logo.svg',
        data: { url: '/' }
      })
    )
  }
})
