const CACHE_NAME = 'secretsanta-v1'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Only cache static assets, never API responses or HTML pages with dynamic content
const CACHEABLE_EXTENSIONS = /\.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)$/

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

  // Skip API calls, non-GET requests, and non-cacheable resources
  if (url.pathname.startsWith('/api/') || request.method !== 'GET') return
  if (!CACHEABLE_EXTENSIONS.test(url.pathname) && url.pathname !== '/' && url.pathname !== '/index.html') return

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  )
})
