const CACHE_NAME = 'rbmt-shell-v3'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return
  if (new URL(event.request.url).pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request))
    return
  }
  const isNavigation = event.request.mode === 'navigate'
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    try {
      const response = await fetch(event.request)
      if (response.ok && (isNavigation || event.request.destination === 'script')) {
        await cache.put(event.request, response.clone())
      }
      return response
    } catch (error) {
      const cached = await cache.match(event.request)
      if (cached) return cached
      if (isNavigation) {
        const shell = await cache.match('/index.html')
        if (shell) return shell
      }
      throw error
    }
  })())
})
