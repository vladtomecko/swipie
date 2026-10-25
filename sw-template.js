const VERSION = __SW_VERSION__
const PRECACHE = `swipie-shell-${VERSION}`
const IMAGES = 'swipie-images-v1'
const IMAGE_LIMIT = 200
const SHELL = __SW_ASSETS__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== PRECACHE && k !== IMAGES).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

async function trimImages() {
  const cache = await caches.open(IMAGES)
  const keys = await cache.keys()
  for (const key of keys.slice(0, Math.max(0, keys.length - IMAGE_LIMIT))) await cache.delete(key)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(PRECACHE)
        return (await cache.match(request, { ignoreSearch: true })) || cache.match('./index.html')
      }),
    )
    return
  }

  if (url.hostname === 'media.rawg.io') {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((res) => {
            if (res.ok || res.type === 'opaque') {
              cache.put(request, res.clone()).then(trimImages)
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      }),
    )
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(PRECACHE).then((cache) => cache.put(request, copy))
            }
            return res
          }),
      ),
    )
  }
})
