// Self-destructing service worker.
// The old CViper cloud app registered a service worker at /sw.js that cached
// the app shell. Returning visitors would otherwise keep seeing the dead app.
// This file replaces it: it installs, deletes every cache, unregisters itself,
// and reloads any open tabs so they fetch the real page.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      var clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (c) { c.navigate(c.url); });
    } catch (e) {}
  })());
});
// No fetch handler on purpose: nothing is ever served from here.