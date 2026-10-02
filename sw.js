// Offline support. Tickets live in IndexedDB; this caches the app itself,
// the home page content, the map library and map tiles you've viewed.
// Bump VERSION whenever you deploy changes so installed apps show "Refresh".
const VERSION = '3.1.0';
const SHELL_CACHE = `tm-shell-${VERSION}`;
const RUNTIME_CACHE = 'tm-runtime';
const TILE_CACHE = 'tm-tiles';
const MAX_TILES = 600;

const SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './db.js',
  './map.js',
  './home.js',
  './tickets.js',
  './manifest.json',
  './content/home.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL);
    // Replacing the old multi-page app: take over straight away.
    const keys = await caches.keys();
    if (keys.some(k => k.startsWith('ticketmaster-cache'))) self.skipWaiting();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        // also clears caches left by the old multi-page app
        .filter(k => (k.startsWith('tm-shell-') && k !== SHELL_CACHE) || k.startsWith('tm-wallet-') || k.startsWith('ticketmaster-cache'))
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copy = res.clone();
      caches.open(cacheName).then(c => c.put(request, copy));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    throw err;
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') {
    const cache = await caches.open(cacheName);
    await cache.put(request, res.clone());
    if (limit) {
      const keys = await cache.keys();
      if (keys.length > limit) await Promise.all(keys.slice(0, keys.length - limit).map(k => cache.delete(k)));
    }
  }
  return res;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Map tiles: cache-first so venues you've opened still show offline.
  if (url.hostname.endsWith('basemaps.cartocdn.com') || url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(cacheFirst(request, TILE_CACHE, MAX_TILES));
    return;
  }
  // Map library from the CDN never changes for a given version.
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Everything of our own: network first so updates appear right away.
  event.respondWith(networkFirst(request, SHELL_CACHE));
});
