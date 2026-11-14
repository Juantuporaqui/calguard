/**
 * CalGuard Service Worker v2
 * Stale-while-revalidate strategy for assets
 * Clean cache versioning
 */

const CACHE_VERSION = 'calguard-v53';
const SHARE_CACHE = 'calguard-shared'; // temp storage for Web Share Target files
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/state/store.js',
  './js/state/toasts.js',
  './js/persistence/db.js',
  './js/persistence/migrations.js',
  './js/persistence/crypto.js',
  './js/persistence/tokenVault.js',
  './js/persistence/vaultSession.js',
  './js/persistence/backup.js',
  './js/domain/rules.js',
  './js/domain/ledger.js',
  './js/domain/reconcile.js',
  './js/domain/notes.js',
  './js/domain/compensations.js',
  './js/domain/services.js',
  './js/domain/balances.js',
  './js/domain/profiles.js',
  './js/domain/groupCuadrante.js',
  './js/domain/cuadranteSync.js',
  './js/domain/changes.js',
  './js/domain/events.js',
  './js/domain/sharedCuadrante.js',
  './js/domain/fichas.js',
  './js/ui/renderer.js',
  './js/ui/nav.js',
  './js/ui/dashboard.js',
  './js/ui/calendar.js',
  './js/ui/calendar/views.js',
  './js/ui/calendar/selection.js',
  './js/ui/calendar/dialogs.js',
  './js/ui/calendar/actions.js',
  './js/ui/calendar/share.js',
  './js/ui/calendar/grid.js',
  './js/ui/cuadrante.js',
  './js/ui/registry.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './js/ui/settings/common.js',
  './js/ui/settings/profile.js',
  './js/ui/settings/days.js',
  './js/ui/settings/group.js',
  './js/ui/settings/security.js',
  './js/ui/settings/backup.js',
  './js/ui/settings/look.js',
  './js/ui/settings/admin.js',
  './js/ui/settings/advanced.js',
  './js/ui/settings/danger.js',
  './js/ui/pin.js',
  './js/ui/icons.js',
  './js/ui/glossary.js',
  './js/ui/onboarding.js',
  './js/ui/onboardingCheck.js',
  './js/ui/emptyStates.js',
  './js/ui/cuadranteView.js',
  './js/ui/diagnostics.js',
  './js/ui/lockScreen.js',
  './js/ui/toast.js',
  './js/ui/labels.js',
  './js/ui/router.js',
  './js/ui/more.js',
  './js/ui/companions.js',
  './js/ui/weekStrip.js',
  './js/ui/alerts.js',
  './js/ui/alertPrefs.js',
  './js/ui/noDays.js',
  './js/ui/syncReport.js',
  './js/ui/utils.js',
  './js/ui/theme.js',
  './js/ui/sheet.js',
  './js/ui/flows.js',
  './js/ui/header.js',
  './js/ui/fichasAdmin.js',
  './js/ui/compensaciones.js',
  './js/ui/jefatura.js',
  './js/ui/biblioteca.js',
  './js/ui/markdown.js',
  './js/domain/library.js',
  './js/ui/help.js',
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

// Install: precache the full asset set for this version, then take over at
// once. Updates must reach every phone without the user doing anything (an
// installed PWA may never close all its tabs, so a waiting worker could wait
// forever). The page reloads itself on 'controllerchange' when it is safe
// (nothing half-done on screen), so module versions never stay mixed.
//
// Every file is downloaded fresh for THIS version: GitHub Pages lets its CDN
// and the browser keep each file for up to 10 minutes, so a phone updating
// right after a release could otherwise store an old cuadrante.js or
// styles.css under the new version and never show the changes. A query string
// unique to the version skips those caches; the file is stored under its
// normal address, which is what the app asks for.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(ASSETS_TO_CACHE.map(async (url) => {
      const fresh = `${url}${url.includes('?') ? '&' : '?'}v=${CACHE_VERSION}`;
      const res = await fetch(new Request(fresh, { cache: 'reload' }));
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      await cache.put(url, res);
    }));
    await self.skipWaiting();
  })().catch(err => {
    console.error('[SW] precache failed:', err);
    throw err;
  }));
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

  // Published group cuadrante: always from the network, never cached here
  if (new URL(event.request.url).pathname.includes('/data/')) return;

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
