/* ─────────────────────────────────────────────────────────
   NexoraCare Service Worker v10 — Next.js-Safe Offline-First
   + Background Sync for queued WhatsApp / mutation requests
   ───────────────────────────────────────────────────────── */

const SHELL_CACHE  = 'nexora-shell-v10';
const API_CACHE    = 'nexora-api-v10';
const STATIC_CACHE = 'nexora-static-v10';

/* ── Install ── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(c =>
      c.addAll(['/offline.html', '/icon.svg']).catch(() => {})
    )
  );
});

/* ── Activate — handled at bottom with flush ── */

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/cron')) return;

  // CRITICAL: never intercept Next.js RSC or HMR fetch requests.
  // Returning cached HTML for these causes Next.js to detect a format
  // mismatch and fall back to a full hard reload on every navigation.
  if (url.searchParams.has('_rsc') || url.searchParams.has('_next')) return;

  /* ── /_next/static/ — cache-first forever (content-addressed filenames) ── */
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        if (res.ok) caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
        return res;
      }).catch(() => new Response('', { status: 503 })))
    );
    return;
  }

  /* Skip other internal Next.js paths (HMR, image optimisation, etc.) */
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

  /* ── Navigation — network-first, offline fallback ──
     Only intercept clean HTML page requests (no query params that
     look like RSC/HMR). RSC and /_next/ requests are already
     excluded above so they go straight to the network. ── */
  event.respondWith((async () => {
    try {
      const res = await fetch(request);
      if (res.ok) {
        // Cache the HTML page for offline use
        const clone = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(url.pathname, clone));
      }
      return res;
    } catch {
      // Offline: serve cached page or offline fallback
      const cached = await caches.match(url.pathname);
      if (cached) return cached;
      return (await caches.match('/offline.html')) ||
        new Response(
          '<!DOCTYPE html><html><body style="background:#0a0b14;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px">' +
          '<h1 style="font-size:1.5rem">You\'re Offline</h1>' +
          '<p style="color:#64748b;text-align:center">Pages you\'ve visited will load from cache.<br>New pages need internet first.</p>' +
          '<button onclick="location.reload()" style="margin-top:8px;padding:10px 24px;background:#1d4ed8;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem">Retry</button>' +
          '</body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
    }
  })());
});

/* ── Push notification ── */
self.addEventListener('push', event => {
  let data = { title: 'NexoraCare', body: 'New notification', url: '/appointments' };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
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

/* ── Background Sync: flush offline-queued requests ── */
const IDB_NAME  = 'nexora-offline-v1';
const IDB_STORE = 'queue';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function getQueued(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.timestamp - b.timestamp));
    req.onerror   = () => reject(req.error);
  });
}

async function deleteQueued(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function flushQueue() {
  const db    = await openIDB();
  const items = await getQueued(db);
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method:  item.method,
        headers: item.headers,
        body:    item.body,
      });
      if (res.ok || res.status < 500) {
        // Request delivered (even if API returned 4xx — don't retry)
        await deleteQueued(db, item.id);
        // Notify open clients that a queued message was sent
        self.clients.matchAll({ type: 'window' }).then(cs =>
          cs.forEach(c => c.postMessage({ type: 'QUEUE_FLUSHED', id: item.id, url: item.url }))
        );
      }
    } catch {
      // Still offline — leave in queue, will retry on next sync
    }
  }
}

self.addEventListener('sync', event => {
  if (event.tag === 'nexora-queue-flush') {
    event.waitUntil(flushQueue());
  }
});

/* Fallback: also flush on SW activate (catches browsers without Background Sync API) */
self.addEventListener('activate', event => {
  const keep = [SHELL_CACHE, API_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => flushQueue().catch(() => {}))
  );
});
