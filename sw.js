const CACHE_NAME = 'xoxo-v4';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './favicon.ico',
    './favicon-16x16.png',
    './favicon-32x32.png',
    './apple-touch-icon.png'
];

// Install the Service Worker
self.addEventListener('install', event => {
    // Force immediate takeover
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Cache opened: ' + CACHE_NAME);
                // Use { cache: 'reload' } to force fetch from network instead of HTTP cache
                const cacheRequests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
                return cache.addAll(cacheRequests);
            })
    );
});

// Fetch Strategy: Network First, Fallback to Cache
self.addEventListener('fetch', event => {
    // Ignore non-GET requests (e.g. POST, WebSockets, WebRTC signaling)
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// Update Service Worker & clean old caches
self.addEventListener('activate', event => {
    // Immediately claim clients
    event.waitUntil(self.clients.claim());
    
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[Service Worker] Deleting old cache: ' + cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});