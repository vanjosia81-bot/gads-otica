// GAD'S Ótica — Service Worker v1.0
// Estratégia: Cache First para assets, Network First para dados

const CACHE_NAME = 'gads-v1';
const STATIC_CACHE = 'gads-static-v1';
const DYNAMIC_CACHE = 'gads-dynamic-v1';

const STATIC_ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
];

const CDN_CACHE = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// Install: cache static assets
self.addEventListener('install', event => {
  console.log('[SW] GAD\'S Ótica SW v1 installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'reload'}))))
      .then(() => self.skipWaiting())
      .catch(err => console.log('[SW] Cache install failed (normal in dev):', err))
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] GAD\'S Ótica SW v1 activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);

  // Fonts: Cache First
  if (CDN_CACHE.some(c => request.url.startsWith(c))) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(res => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Static assets: Cache First
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(res => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          return res;
        }).catch(() => caches.match('/index.html'))
      )
    );
    return;
  }

  // Default: Network First with cache fallback
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request) || caches.match('/index.html'))
    );
  }
});

// Background sync for offline cart
self.addEventListener('sync', event => {
  if (event.tag === 'sync-cart') {
    console.log('[SW] Syncing cart...');
  }
});

// Push notifications
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "GAD'S Ótica", {
      body: data.body || 'Novidades na GAD\'S Ótica!',
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: [200, 100, 200],
      data: {url: data.url || '/'},
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
