/* ─────────────────────────────────────────────────────────
   NexoraCare Service Worker — Web Push handler
   ───────────────────────────────────────────────────────── */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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
