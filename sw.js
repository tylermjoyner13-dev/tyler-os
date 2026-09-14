const CACHE = 'tyler-os-mobile-v1-5-6-asset-fix';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=156',
  './program-data.js?v=156',
  './logic.js?v=156',
  './app.js?v=156',
  './manifest.webmanifest?v=156',
  './icons/icon.svg?v=156'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(APP_SHELL.map(url => fetch(url, { cache: 'reload' })
        .then(response => {
          if (!response || !response.ok) throw new Error('Failed to fetch ' + url);
          return cache.put(url, response.clone());
        }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations are network-first. This prevents an old cached index.html from pinning the installed PWA to a broken build.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // App assets are network-first with cache fallback so updated JS/CSS cannot remain stale indefinitely.
  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return response;
      })
      .catch(() => caches.match(req))
  );
});
