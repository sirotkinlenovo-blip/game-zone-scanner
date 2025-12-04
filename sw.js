// Версия кэша
const CACHE_NAME = 'gamezone-v5.1';

// Файлы для кэширования
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.1/dist/quagga.min.js',
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap',
    'https://avatars.mds.yandex.net/get-altay/16915650/2a0000019a24cb39e7e0f13ab054c8530af6/S_height'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('📦 Service Worker: установка');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Кэшируем файлы');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ Все файлы закэшированы');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Ошибка кэширования:', error);
            })
    );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', event => {
    console.log('🔧 Service Worker: активация');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Удаляем старый кэш:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('✅ Старые кэши очищены');
            return self.clients.claim();
        })
    );
});

// Стратегия: Network First, Fallback to Cache
self.addEventListener('fetch', event => {
    // Пропускаем запросы к Google Sheets
    if (event.request.url.includes('docs.google.com')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Клонируем response для кэша
                const responseToCache = response.clone();
                
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        
                        // Для страниц возвращаем главную
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        
                        // Для остальных запросов возвращаем заглушку
                        return new Response('Офлайн режим', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Обработка сообщений от основного потока
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Фоновая синхронизация
self.addEventListener('sync', event => {
    if (event.tag === 'sync-logs') {
        console.log('🔄 Фоновая синхронизация логов');
        event.waitUntil(syncLogs());
    }
});

// Периодическая синхронизация
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-games') {
        console.log('🔄 Периодическая синхронизация игр');
        event.waitUntil(updateGamesData());
    }
});

// Функции синхронизации
async function syncLogs() {
    // Здесь можно реализовать синхронизацию логов с сервером
    console.log('Синхронизация логов...');
}

async function updateGamesData() {
    // Здесь можно реализовать обновление данных игр
    console.log('Обновление данных игр...');
}
