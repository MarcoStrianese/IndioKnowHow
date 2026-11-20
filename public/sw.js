// Service worker di IndioKnowHow
// - pagina principale: prima la rete, poi la copia salvata (così gli aggiornamenti arrivano subito)
// - file dell'app (js/css/icone, con nome che cambia a ogni build): dalla cache
// - immagini delle note (URL firmati di Supabase Storage): dalla cache, così si vedono anche offline
// I dati delle note NON passano da qui: sono salvati dall'app in IndexedDB.

const APP_CACHE = 'ikh-app-v1';
const IMG_CACHE = 'ikh-img-v1';

// All'installazione salva subito la pagina e i file js/css che usa, così l'app parte anche offline.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(APP_CACHE);
      await c.addAll(['./', './icon.svg', './manifest.webmanifest', './apple-touch-icon.png']);
      const html = await (await fetch('./index.html', { cache: 'no-store' })).text();
      await c.put('./index.html', new Response(html, { headers: { 'content-type': 'text/html' } }));
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await c.addAll(assets);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![APP_CACHE, IMG_CACHE].includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Immagini delle note
  if (url.pathname.includes('/storage/v1/object/sign/')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigazione: rete prima, poi cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(APP_CACHE).then((c) => c.put('./index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // File statici: cache prima, poi rete
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(APP_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
    )
  );
});
