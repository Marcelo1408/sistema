const CACHE = 'Hamburgueria-v1';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api')) return; // nunca cacheia a API
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(e.request);
      const rede = fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) cache.put(e.request, res.clone());
        return res;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});