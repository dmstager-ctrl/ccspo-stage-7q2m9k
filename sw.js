/* Crestmark Portal — staging service worker, v2.
   v1 was cache-first for everything, including index.html/po-tool.html — the two tiny
   routing/gate pages whose whole job is to redirect based on fresh logic. Cache-first on
   those meant a stale gate could keep redirecting to the wrong place after code changes,
   which is exactly the bug that bit the PO Tool deep link. Fix: HTML documents (navigation
   requests) go network-first now, only falling back to cache if the network is unreachable.
   Bumping CACHE_NAME also discards the old v1 cache entirely on activate. */
const CACHE_NAME = 'crestmark-staging-shell-v2';
const SHELL_FILES = ['manifest.json','po-tool-manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Navigation / HTML requests: always try the network first so routing logic (the
  // passcode gate, the po-tool.html redirect) is never served stale.
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (icons, manifests, css/js): cache-first is fine, these don't drive routing.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
