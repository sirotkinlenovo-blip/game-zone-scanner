// Service Worker для GAME ZONE Scanner
const CACHE_NAME = 'game-zone-scanner-v2.8';
const urlsToCache = [
  './',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker установлен');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Для Google Sheets и Quagga - всегда сеть, потом кэш
  if (event.request.url.includes('google.com/spreadsheets') || 
      event.request.url.includes('quagga')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  } else {
    // Для остального - сначала кэш, потом сеть
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker активирован');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});