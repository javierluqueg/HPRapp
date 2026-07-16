// HPRapp Service Worker v4
// Estrategia: red primero, con respaldo en caché para uso offline.
// - Si hay conexión: siempre trae la versión más fresca de la red y actualiza el caché.
// - Si NO hay conexión: sirve la última copia guardada (permite abrir la app en modo avión).
// - El aviso de "nueva versión disponible" (banner azul) sigue funcionando igual,
//   comparando el APP_VERSION del index.html contra el publicado en GitHub.

const SW_VERSION = '4'
const CACHE_NAME = 'hprapp-cache-v' + SW_VERSION

// URL canónica del shell de la app (ignora query strings de cache-busting al guardar/leer del caché)
const APP_SHELL_URL = new URL('./index.html', self.location).href

// Librerías externas necesarias para que la app funcione offline
const PRECACHE_URLS = [
  APP_SHELL_URL,
  'https://cdn.jsdelivr.net/npm/dexie@3.2.7/dist/dexie.min.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
]

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(PRECACHE_URLS.map(url =>
        fetch(url, { cache: 'reload' })
          .then(res => { if (res.ok || res.type === 'opaque') return cache.put(url, res) })
          .catch(() => {}) // si falla un recurso individual, no bloquea la instalación
      ))
    )
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(async () => {
        const clients = await self.clients.matchAll({ type: 'window' })
        clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED' }))
      })
  )
})

function isAppShellRequest(url) {
  return url.pathname === '/' ||
         url.pathname.endsWith('/index.html') ||
         url.pathname.endsWith('/HPRapp/') ||
         url.pathname.endsWith('/HPRapp')
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  const isShell = url.origin === location.origin && isAppShellRequest(url)
  const isPrecachedCDN = PRECACHE_URLS.includes(url.origin + url.pathname)

  // Todo lo demás (api.github.com para chequeo de versión, Firestore, etc.) pasa directo, sin intervenir
  if (!isShell && !isPrecachedCDN) return

  const cacheKey = isShell ? APP_SHELL_URL : event.request

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(res => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, copy)).catch(() => {})
        return res
      })
      .catch(() =>
        caches.match(cacheKey).then(cached => cached || caches.match(APP_SHELL_URL))
      )
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
