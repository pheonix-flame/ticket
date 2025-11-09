const CACHE_NAME = 'ticketmaster-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/home.html',
  '/ticket.html',
  '/for-you.html',
  '/account.html',
  '/my-events.html',
  '/events.html',
  '/qr-code.html',
  '/assets/icon-removebg-preview.png',
  '/assets/icon.png',
  '/assets/WhatsApp Image 2025-05-25 at 20.35.42.jpeg',
  '/banner-handler.js',
  '/eventManager.js',
  '/subscription-enforcer.js',
  '/assets/android-launchericon-192-192.png',
  '/assets/android-launchericon-512-512.png',
  '/api/app.js'
];

// Install – pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // Activate immediately
      .catch(err => console.error('Cache install failed:', err))
  );
});

// Activate – remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // take control immediately
  );
});

// Fetch – network-first for HTML, cache-first for others
self.addEventListener('fetch', event => {
  const { request } = event;

  // For navigation (HTML pages)
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(res => res || caches.match('/index.html')))
    );
    return;
  }

  // For static files (JS, CSS, images)
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(networkResponse => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return networkResponse;
      }).catch(() => caches.match('/assets/icon.png'));
    })
  );
});
