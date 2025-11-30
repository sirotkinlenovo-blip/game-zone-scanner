// Service Worker для GAME ZONE Scanner v2.9
const CACHE_NAME = 'game-zone-scanner-v2.9';
const urlsToCache = [
  './',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker v2.9 установлен');
  
  // Пропускаем фазу ожидания и сразу активируем
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Кэшируем файлы:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker v2.9 активирован');
  
  event.waitUntil(
    Promise.all([
      // Очищаем старые кэши
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Удаляем старый кэш:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Немедленно берем управление клиентами
      self.clients.claim()
    ])
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
    // Стратегия: Сеть -> Кэш
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Клонируем ответ для кэширования
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
