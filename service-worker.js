// Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker instalado');
});
const CACHE_NAME = 'calendario-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/scripts/state.js',
  '/scripts/utils.js',
  '/scripts/db.js',
  '/scripts/calendar.js',
  '/scripts/events.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
