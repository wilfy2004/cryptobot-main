self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/app.js',
        '/styles.css',
        '/manifest.json',
        '/icon-192x192.png',
        '/icon-512x512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
// Add these to your service worker cache list
const urlsToCache = [
    // ... existing URLs ...
    '/api/trade/timing/current',
    '/api/trade/timing/update'
];

// Make sure to handle POST requests appropriately in your fetch event listener
self.addEventListener('fetch', (event) => {
    if (event.request.method === 'POST' && 
        event.request.url.includes('/api/trade/timing/update')) {
        // Don't cache POST requests to the timing update endpoint
        return;
    }
    
    // ... rest of your fetch event handler ...
});
