// Offline support for the ticket wallet. Tickets themselves live in
// IndexedDB; this only caches the app shell so it opens without a network.
const CACHE = 'tm-wallet-v1';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './db.js',
  './manifest.json',
  './icons/android-launchericon-192-192.png',
  './icons/android-launchericon-512-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tm-wallet-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates show up right away), cache as fallback when offline.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then(r => r || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
