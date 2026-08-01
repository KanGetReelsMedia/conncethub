const CACHE_NAME = 'connecthub-v9';
const OFFLINE_URL = './offline.html';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Add one by one so 1 failure doesn't break all
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[ConnectHub SW] Failed to cache', asset, err);
        }
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never cache Firebase / Google APIs - breaks login
  if (
    req.url.includes('firestore') ||
    req.url.includes('firebase') ||
    req.url.includes('googleapis') ||
    req.url.includes('gstatic') ||
    req.url.includes('identitytoolkit')
  ) {
    return;
  }

  // Handle navigation - show offline.html when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // For everything else: cache-first, then network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // Only cache images/videos from your hubs for offline
          if (res.ok && (req.destination === 'image' || req.destination === 'video' || req.url.includes('foundbymk.shop'))) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline and not in cache - return nothing
          if (req.destination === 'image') {
            return caches.match('https://foundbymk.shop/wp-content/uploads/2026/08/Screenshot-2026-08-01-3.07.40-PM.png');
          }
        });
    })
  );
});
