const CACHE_NAME = 'secretsanta-v1'
const PRECACHE_URLS = [
  '/manifest.json',
]

// Cache static assets (JS, CSS, fonts, images) but use network-first for HTML
const CACHEABLE_EXTENSIONS = /\.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)$/
const HTML_ROUTES = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip API calls and non-GET requests
  if (url.pathname.startsWith('/api/') || request.method !== 'GET') return

  // Network-first for HTML to always serve fresh app shell after deployments
  if (HTML_ROUTES.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful same-origin responses
          if (response.ok && response.type === 'basic') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  if (CACHEABLE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
  }
})
