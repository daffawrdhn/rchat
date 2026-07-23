const CACHE_NAME = 'xoxo-v1.0.31-fix-view-once-image-race-condition';
const urlsToCache = [
    './',
    './index.html',
    './privacy.html',
    './terms.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './favicon.ico',
    './favicon-16x16.png',
    './favicon-32x32.png',
    './apple-touch-icon.png',
    './assets/msg.mp3',
    './assets/connect.mp3',
    './assets/disconnect.mp3'
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
        return; // Let browser handle directly
    }

    // Only intercept same-origin requests to prevent CORS/CSP ERR_FAILED errors on third-party assets
    if (!event.request.url.startsWith(self.location.origin)) {
        return; // Let browser handle directly
    }

    console.log('[Service Worker Fetch]', event.request.url);
    event.respondWith(
        fetch(event.request)
            .then(res => {
                console.log('[Service Worker Fetch Success]', event.request.url, res.status);
                return res;
            })
            .catch(err => {
                console.error('[Service Worker Fetch Error]', event.request.url, err);
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        console.log('[Service Worker Fetch Fallback]', event.request.url);
                        return cachedResponse;
                    }
                    // If not in cache, propagate error
                    throw err;
                });
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