/**
 * CalGuard Service Worker v2
 * Stale-while-revalidate strategy for assets
 * Clean cache versioning
 */

const CACHE_VERSION = 'calguard-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/state/store.js',
  './js/persistence/db.js',
  './js/persistence/migrations.js',
  './js/persistence/crypto.js',
  './js/persistence/backup.js',
  './js/domain/rules.js',
  './js/domain/ledger.js',
  './js/domain/services.js',
  './js/ui/renderer.js',
  './js/ui/nav.js',
  './js/ui/dashboard.js',
  './js/ui/calendar.js',
  './js/ui/contextMenu.js',
  './js/ui/registry.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './js/ui/diagnostics.js',
  './js/ui/lockScreen.js',
  './js/ui/toast.js',
  './js/exports/ics.js',
  './js/exports/csv.js',
  './js/exports/templates.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Install: cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: stale-while-revalidate
self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(cache =>
      cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Cache the fresh response
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Network failed, return cached or offline fallback
          return cachedResponse;
        });

        // Return cached immediately, update in background
        return cachedResponse || fetchPromise;
      })
    )
  );
});

// Handle skip waiting message from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
