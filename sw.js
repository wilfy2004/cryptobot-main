const CACHE_NAME = 'trading-bot-dashboard-v1';
const urlsToCache = [
  '/cryptobot-main/',
  '/cryptobot-main/index.html',
  '/cryptobot-main/styles.css',
  '/cryptobot-main/app.js',
  '/cryptobot-main/icon.png',
  '/cryptobot-main/icon-192.png',
  '/cryptobot-main/icon-512.png',
  '/cryptobot-main/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// Optional: Add an activate event listener to clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
