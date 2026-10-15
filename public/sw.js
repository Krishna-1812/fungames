/*
 * The site's service worker, for one thing only: showing the daily reminder
 * (src/lib/push.ts sends it; src/lib/remind.ts asks for it). It caches
 * nothing and never stands between a page and the network.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let m = {}
  try { m = e.data ? e.data.json() : {} } catch { /* a bare push: the defaults below */ }
  const url = typeof m.url === 'string' && m.url.startsWith('/') ? m.url : '/'
  e.waitUntil(self.registration.showNotification(m.title || 'Today’s challenge is waiting', {
    body: m.body || 'A new daily challenge is up on Tiny Island.',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: m.tag || 'daily',
    renotify: false,
    data: { url },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of open) if (new URL(c.url).origin === self.location.origin && 'focus' in c) { await c.focus(); if ('navigate' in c) return c.navigate(url); return }
    return self.clients.openWindow(url)
  })())
})
