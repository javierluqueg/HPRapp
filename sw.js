// HPRapp Service Worker v2
// Estrategia: network-first con fallback a caché.
// Siempre intenta cargar desde red. Si hay nueva versión, la sirve de una.
// Solo usa caché si está offline.

const CACHE_NAME = 'hprapp-v2'
const APP_URL = './index.html'

self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
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

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        if (response.ok) {
          // Guardar en caché para uso offline
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(APP_URL, clone))
        }
        return response
      })
      .catch(() =>
        // Sin red — servir desde caché
        caches.open(CACHE_NAME).then(cache => cache.match(APP_URL))
      )
  )
})
