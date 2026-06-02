/* ─────────────────────────────────────────────────────────
   NexoraCare Service Worker v7 — True Offline-First
   ───────────────────────────────────────────────────────── */

const SHELL_CACHE  = 'nexora-shell-v7';
const API_CACHE    = 'nexora-api-v7';
const STATIC_CACHE = 'nexora-static-v7';

/* ── Install ── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(c =>
      c.addAll(['/offline.html', '/icon.svg']).catch(() => {})
    )
  );
});

/* ── Activate ── */
self.addEventListener('activate', event => {
  const keep = [SHELL_CACHE, API_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/cron')) return;

  /* ── /_next/static/ — cache-first forever ── */
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        if (res.ok) caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
        return res;
      }).catch(() => new Response('', { status: 503 })))
    );
    return;
  }

  /* Skip other /_next/ internals */
  if (url.pathname.startsWith('/_next/')) return;

  /* ── API GET — network-first (always fresh online), cache fallback offline ── */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(API_CACHE).then(c => {
            const h = new Headers(clone.headers);
            h.set('sw-cached-at', Date.now().toString());
            clone.blob().then(b => c.put(request, new Response(b, { status: clone.status, headers: h })));
          });
        }
        return res;
      }).catch(async () => {
        // Offline: serve last cached response
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({ error: 'offline', cached: false }), {
          status: 503, headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  /* ── Navigation — stale-while-revalidate ──
     Key trick: Next.js RSC requests come as /path?_rsc=hash
     We match them against the cached /path (ignoreSearch),
     which causes Next.js to detect "HTML for RSC" and do a
     hard reload — which then hits our cached /path entry. ── */
  event.respondWith((async () => {
    const isRSC = url.searchParams.has('_rsc') || url.searchParams.has('_next');

    // For cache lookup: use base path (ignore RSC query params)
    const cacheKey = isRSC ? new Request(url.pathname) : request;
    const cached = await caches.match(cacheKey);

    // Always fetch fresh (update cache in background)
    const fresh = fetch(request).then(res => {
      if (res.ok && !isRSC) {
        // Only cache clean page navigations, not RSC payloads
        caches.open(SHELL_CACHE).then(c => c.put(url.pathname, res.clone()));
      }
      return res;
    }).catch(() => null);

    if (cached) { fresh; return cached; } // serve cache immediately

    const res = await fresh;
    if (res?.ok) return res;

    // Fallback
    return (await caches.match('/offline.html')) ||
      new Response(
        '<!DOCTYPE html><html><body style="background:#0a0b14;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px"><h1 style="font-size:1.5rem">📡 ' +
        (self.location.pathname.includes('/ar') ? 'أنت غير متصل' : "You're Offline") +
        '</h1><p style="color:#64748b;text-align:center">Pages you\'ve visited will load from cache.<br>New pages need internet first.</p>' +
        '<button onclick="location.reload()" style="margin-top:8px;padding:10px 24px;background:#1d4ed8;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem">Retry</button>' +
        '</body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
  })());
});

/* ── Push notification ── */
self.addEventListener('push', event => {
  let data = { title: 'NexoraCare', body: 'New notification', url: '/appointments' };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      tag: data.tag || 'nexoracare',
      renotify: true,
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/appointments';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) { if (c.url.includes(target) && 'focus' in c) return c.focus(); }
      return self.clients.openWindow(target);
    })
  );
});
