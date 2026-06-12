// HPRapp Service Worker v3
// Estrategia definitiva:
// - NO cachea nada (evita el problema de caché en iOS)
// - Solo existe para interceptar y forzar network en cada carga
// - Se autodesinstala si hay problemas

const SW_VERSION = '3'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Limpiar todos los cachés anteriores
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(async () => {
        // Notificar a todos los clientes que recarguen
        const clients = await self.clients.matchAll({ type: 'window' })
        clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED' }))
      })
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return

  const isAppShell = url.pathname === '/' ||
                     url.pathname.endsWith('/index.html') ||
                     url.pathname.endsWith('/HPRapp/') ||
                     url.pathname.endsWith('/HPRapp')
  if (!isAppShell) return

  // Siempre red, nunca caché
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .catch(() => fetch(event.request)) // retry sin parámetros si falla
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
