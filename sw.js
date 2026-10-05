// Service Worker untuk PWA An-Nama' Quiz
const CACHE_NAME = 'annama-quiz-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Biarkan request diteruskan secara live
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
