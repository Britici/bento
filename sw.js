/* Service worker: funciona offline. Estratégia: cache primeiro, atualiza em segundo plano.
   Ao publicar mudanças, a nova versão aparece na SEGUNDA abertura do app. */
const CACHE = 'mdn-v2';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req)
      .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    return req.mode === 'navigate' ? (await cache.match('./index.html')) || Response.error() : Response.error();
  }));
});
