// Service Worker para CalGuard PWA
const CACHE_NAME = 'calguard-v2.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/scripts/utils.js',
    '/scripts/db.js',
    '/scripts/calendar.js',
    '/scripts/events.js',
    '/manifest.webmanifest',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando archivos');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[Service Worker] Instalación completada');
                return self.skipWaiting(); // Activar inmediatamente
            })
            .catch((error) => {
                console.error('[Service Worker] Error en instalación:', error);
            })
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Eliminando caché antigua:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activación completada');
                return self.clients.claim(); // Tomar control de todas las páginas
            })
    );
});

// Interceptar peticiones (estrategia Network First con fallback a Cache)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta es válida, cachearla
                if (response && response.status === 200) {
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                }

                return response;
            })
            .catch(() => {
                // Si falla la red, intentar obtener del caché
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }

                        // Si no está en caché y es una navegación, mostrar página offline
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }

                        return new Response('Contenido no disponible offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Sincronización en segundo plano
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Sincronización:', event.tag);

    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

// Notificaciones push
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push recibido');

    const options = {
        body: event.data ? event.data.text() : 'Nueva notificación',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification('CalGuard', options)
    );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notificación clickeada');

    event.notification.close();

    event.waitUntil(
        clients.openWindow('/')
    );
});

// Función auxiliar para sincronizar datos
async function syncData() {
    try {
        // Aquí puedes agregar lógica de sincronización
        console.log('[Service Worker] Sincronizando datos...');
        return Promise.resolve();
    } catch (error) {
        console.error('[Service Worker] Error en sincronización:', error);
        return Promise.reject(error);
    }
}

// Manejo de mensajes del cliente
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Mensaje recibido:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});
