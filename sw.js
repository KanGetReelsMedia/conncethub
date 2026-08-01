const CACHE_NAME = 'connecthub-v10';
const OFFLINE_URL = './offline.html';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
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

  // Never cache Firebase
  if (
    req.url.includes('firestore') ||
    req.url.includes('firebase') ||
    req.url.includes('googleapis') ||
    req.url.includes('gstatic') ||
    req.url.includes('identitytoolkit')
  ) {
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && (req.destination === 'image' || req.destination === 'style' || req.destination === 'script')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
