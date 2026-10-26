// App shell cache: screens open instantly and still load on a bad connection.
// API calls always go to the network so slots and bookings are never stale.
// Paths are relative to where the worker lives: "/" or "/g/<gym>/" on the platform.
const CACHE = 'gym-shell-v5';
const BASE = new URL(self.registration.scope).pathname;
const SHELL = ['', 'index.html', 'base.css', 'gym.css', 'app.css', 'config.js', 'icons.js', 'common.js', 'app.js', 'nutrition.js', 'body.js', 'coach.js', 'workout.js', 'icon.svg'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const rel = url.pathname.slice(BASE.length - 1);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(BASE) || rel.startsWith('/api/') || rel.startsWith('/admin')) return;
  // Network first, falling back to the cached copy when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match(BASE)))
  );
});
