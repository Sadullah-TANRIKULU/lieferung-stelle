const CACHE_NAME = 'lieferung-stelle-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/bestellung.html',
  '/admin.html',
  '/tour.html',
  '/loading.html',
  '/scan.html',
  '/manifest.json',
  '/assets/icon.svg'
];

// Install event: cache basic layout pages and assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network-first for pages, cache-first for static assets, network-only for API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. If it's an API call, go network-only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Network-first strategy for main html routes to keep UI fresh but support offline
  if (event.request.mode === 'navigate' || ASSETS_TO_CACHE.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Put clone of response in cache if valid
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. Cache-first strategy for other static resources (images, fonts, scripts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
