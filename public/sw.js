/* ─────────────────────────────────────────────────────────
   NexoraCare Service Worker
   - Web Push notifications
   - App shell caching for offline access
   - Network-first API caching (GET only)
   ───────────────────────────────────────────────────────── */

const CACHE_NAME     = 'nexora-shell-v2';
const API_CACHE_NAME = 'nexora-api-v2';
const API_TTL_MS     = 5 * 60 * 1000; // 5 min

const SHELL_URLS = [
  '/',
  '/login',
  '/appointments',
  '/calendar',
  '/customers',
  '/prescriptions',
  '/dashboard',
  '/icon.svg',
];

/* ── Install: cache app shell ── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(SHELL_URLS).catch(() => {/* non-fatal */})
    )
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME && k !== API_CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first with cache fallback ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET and Next.js internals
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/_next/')) return;
  if (url.pathname.startsWith('/api/cron')) return;

  // API GET requests: network-first, cache 5 min
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(API_CACHE_NAME).then(cache => {
            const headers = new Headers(clone.headers);
            headers.set('sw-cached-at', Date.now().toString());
            clone.blob().then(body => {
              cache.put(request, new Response(body, { status: clone.status, headers }));
            });
          });
        }
        return res;
      }).catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          const age = Date.now() - parseInt(cached.headers.get('sw-cached-at') || '0', 10);
          if (age < API_TTL_MS * 12) return cached; // serve stale cache up to 1 hr offline
        }
        return new Response(JSON.stringify({ error: 'offline', cached: false }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Navigation / shell: network-first, fall back to shell cache
  event.respondWith(
    fetch(request).then(res => {
      if (res.ok) {
        caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
      }
      return res;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      // Return the root shell for unknown navigation requests
      const root = await caches.match('/');
      return root || new Response('Offline', { status: 503 });
    })
  );
});

/* ── Push event: show the notification ── */
self.addEventListener('push', event => {
  let data = { title: 'NexoraCare', body: 'You have a new notification', url: '/appointments' };
  try { data = { ...data, ...event.data.json() }; } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'nexoracare',
      renotify: true,
      data: { url: data.url },
    })
  );
});

/* ── Notification click: focus or open the target URL ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/appointments';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
