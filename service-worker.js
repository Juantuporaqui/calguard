/**
 * CalGuard Service Worker v2
 * Stale-while-revalidate strategy for assets
 * Clean cache versioning
 */

const CACHE_VERSION = 'calguard-v11';
const SHARE_CACHE = 'calguard-shared'; // temp storage for Web Share Target files
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
  './js/domain/reconcile.js',
  './js/domain/services.js',
  './js/ui/renderer.js',
  './js/ui/nav.js',
  './js/ui/dashboard.js',
  './js/ui/calendar.js',
  './js/ui/cuadrante.js',
  './js/ui/contextMenu.js',
  './js/ui/registry.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './js/ui/diagnostics.js',
  './js/ui/lockScreen.js',
  './js/ui/toast.js',
  './js/ui/utils.js',
  './js/exports/ics.js',
  './js/exports/csv.js',
  './js/exports/templates.js',
  './js/imports/cuadranteParser.js',
  './vendor/xlsx.full.min.js',
  './vendor/pdf.min.mjs',
  './vendor/pdf.worker.min.mjs',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Install: precache the full asset set for this version.
// No skipWaiting() here: the new SW waits until the user accepts the
// update banner (SKIP_WAITING message), so the running app never mixes
// module versions and never reloads by surprise.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => {
        console.error('[SW] precache failed:', err);
        throw err;
      })
  );
});

// Activate: clean old caches (keep the share-target temp cache)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_VERSION && key !== SHARE_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for precached assets (guarantees a coherent set of
// module versions — updates only arrive as a whole via a new CACHE_VERSION),
// network with cache fallback for anything else, index.html for navigations.
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Web Share Target: a file shared to the installed app arrives as a POST.
  // Stash it in a temp cache and redirect to the app, which imports it on boot.
  if (event.request.method === 'POST' && new URL(event.request.url).pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file');
        if (file && typeof file.arrayBuffer === 'function') {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put('./shared-file', new Response(await file.arrayBuffer(), {
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              'X-File-Name': encodeURIComponent(file.name || 'cuadrante.xlsx')
            }
          }));
        }
      } catch (err) {
        console.error('[SW] share-target failed:', err);
      }
      return Response.redirect('./index.html#shared-import', 303);
    })());
    return;
  }

  // Only handle same-origin GET requests from here on
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(cache =>
      cache.match(event.request, { ignoreSearch: event.request.mode === 'navigate' }).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Offline and not cached: fall back to the app shell for navigations
          if (event.request.mode === 'navigate') {
            return cache.match('./index.html');
          }
          return Response.error();
        });
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
