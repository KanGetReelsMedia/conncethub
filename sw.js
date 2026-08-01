const CACHE_NAME = 'connecthub-v7';
const OFFLINE_URL = './offline.html';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Add one by one so 1 failure doesn't break all
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[ConnectHub SW] Failed to cache', asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Skip Firebase / API calls - never cache those
  if (req.url.includes('firestore') || req.url.includes('firebase') || req.url.includes('googleapis')) {
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((res) => {
          // Cache images/videos from your hub for offline
          if (req.destination === 'image' || req.destination === 'video') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => {
          // Offline fallback
        });
      })
    );
  }
});
