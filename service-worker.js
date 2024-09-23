// Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker instalado');
});
const CACHE_NAME = 'calendario-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
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
