/// <reference lib="webworker" />
/** Eigener Service Worker (injectManifest): Precache + API-Caching wie zuvor,
 *  NEU: Web-Push-Empfang und Klick-Handling. */
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

// Build-Assets precachen (von vite-plugin-pwa injiziert)
precacheAndRoute(self.__WB_MANIFEST)

// SPA-Navigation -> index.html (ausser API/Socket)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/socket\.io\//],
  }),
)

// API: Network-first mit kurzem Timeout
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
  }),
)

// Update-Flow: skipWaiting auf Nutzerbestätigung (Update-Toast)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Web-Push empfangen
self.addEventListener('push', (event) => {
  let payload = { title: 'CatBoter', body: '', tag: 'catboter' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    /* Text-Fallback */
    payload.body = event.data?.text() ?? ''
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  )
})

// Klick auf Notification -> App öffnen/fokussieren
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
