// =============================================
// КОНСТАНТЫ И НАСТРОЙКИ
// =============================================

// Версия программы
const APP_VERSION = "5.1";
document.getElementById('app-version-number').textContent = APP_VERSION;

// Проверяем режим из URL и localStorage
const urlParams = new URLSearchParams(window.location.search);
const isUrlClientMode = urlParams.get('mode') === 'client';
const savedMode = localStorage.getItem('gamezone_mode');

// Определяем режим работы
const isClientMode = isUrlClientMode ? true : 
                   (savedMode ? savedMode === 'client' : false);

// Уникальный ID устройства
const DEVICE_ID = localStorage.getItem('gamezone_device_id') || 
                 'DEV_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('gamezone_device_id', DEVICE_ID);

// Константы для производительности
const SCAN_COOLDOWN_MS = 300; // Задержка между сканированиями
const SEARCH_DEBOUNCE_MS = 300; // Задержка для поиска
const LOG_CLEANUP_DAYS = 30; // Очищать логи старше дней

// =============================================
// КЛАСС ЛОГГЕРА С ОПТИМИЗАЦИЕЙ
// =============================================

class SimpleLogger {
    constructor() {
        this.appLog = [];
        this.salesLog = [];
        this.deviceId = DEVICE_ID;
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.cleanupOldLogs(); // Очистка старых логов при запуске
        this.syncWithOtherDevices();
        console.log(`📊 Логгер инициализирован на устройстве: ${this.deviceId}`);
        
        // Периодическая синхронизация и очистка
        setInterval(() => this.syncWithOtherDevices(), 5 * 60 * 1000); // Каждые 5 минут
        setInterval(() => this.cleanupOldLogs(), 24 * 60 * 60 * 1000); // Раз в день
    }

    // Очистка старых логов для экономии памяти
    cleanupOldLogs() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - LOG_CLEANUP_DAYS);
            
            // Очищаем старые продажи
            this.salesLog = this.salesLog.filter(sale => 
                new Date(sale.timestamp) > cutoffDate
            );
            
            // Очищаем старые действия (оставляем последние 500)
            this.appLog = this.appLog.slice(-500);
            
            console.log(`🧹 Очистка логов: осталось ${this.salesLog.length} продаж, ${this.appLog.length} действий`);
            this.saveToStorage();
            
        } catch (error) {
            console.error('❌ Ошибка очистки логов:', error);
        }
    }

    // Синхронизация логов между устройствами
    syncWithOtherDevices() {
        try {
            const allLogs = {};
            
            // Собираем все логи из localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('gamezone_logs_')) {
                    try {
                        const logs = JSON.parse(localStorage.getItem(key));
                        if (logs?.deviceId && logs.salesLog) {
                            allLogs[logs.deviceId] = logs;
                        }
                    } catch (e) {
                        console.log(`Ошибка парсинга логов из ${key}`);
                    }
                }
            }
            
            // Объединяем все логи
            let mergedLogs = {
                deviceId: this.deviceId,
                appLog: [...this.appLog],
                salesLog: [...this.salesLog]
            };
            
            // Добавляем логи с других устройств
            Object.values(allLogs).forEach(logs => {
                if (logs.deviceId !== this.deviceId) {
                    // Добавляем уникальные продажи
                    logs.salesLog.forEach(sale => {
                        if (!mergedLogs.salesLog.some(s => s.saleId === sale.saleId)) {
                            mergedLogs.salesLog.push(sale);
                        }
                    });
                    
                    // Добавляем уникальные действия
                    logs.appLog.forEach(action => {
                        if (!mergedLogs.appLog.some(a => 
                            a.timestamp === action.timestamp && 
                            a.action === action.action)) {
                            mergedLogs.appLog.push(action);
                        }
                    });
                }
            });
            
            // Сортируем и обрезаем
            mergedLogs.salesLog.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            mergedLogs.appLog.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            mergedLogs.salesLog = mergedLogs.salesLog.slice(-1000);
            mergedLogs.appLog = mergedLogs.appLog.slice(-500);
            
            // Обновляем данные
            this.salesLog = mergedLogs.salesLog;
            this.appLog = mergedLogs.appLog;
            this.saveToStorage();
            
            console.log(`🔄 Синхронизировано: ${this.salesLog.length} продаж, ${this.appLog.length} действий`);
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
        }
    }

    // Умный поиск
    smartSearch(gamesData, query) {
        if (!query || query.length < 2) return [];
        
        const searchQuery = query.toLowerCase().trim();
        const results = [];
        
        gamesData.forEach(game => {
            let score = 0;
            
            // Поиск по названию
            if (game.name && game.name.toLowerCase().includes(searchQuery)) {
                score += 100;
            }
            
            // Поиск по коду
            if (game.code && game.code.toLowerCase().includes(searchQuery)) {
                score += 80;
            }
            
            // Поиск по штрих-коду
            if (game.barcode) {
                const barcodes = game.barcode.split('/').map(b => b.trim());
                if (barcodes.some(b => b.includes(searchQuery))) {
                    score += 70;
                }
            }
            
            if (score > 0) {
                results.push({ game, score });
            }
        });
        
        results.sort((a, b) => b.score - a.score);
        return results.map(r => r.game);
    }

    // Логирование действий
    logAppAction(action, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: action,
            details: details,
            deviceId: this.deviceId
        };
        
        this.appLog.push(logEntry);
        this.saveToStorage();
        console.log(`📝 ${action}:`, details);
        
        return logEntry;
    }

    // Логирование продаж
    logSale(saleData) {
        const saleEntry = {
            timestamp: new Date().toISOString(),
            saleId: 'SALE_' + Date.now() + '_' + this.deviceId,
            items: saleData.items.map(item => ({
                name: item.name,
                platform: item.platform,
                price: item.price,
                quantity: item.quantity,
                total: item.total
            })),
            totalAmount: saleData.totalAmount,
            totalItems: saleData.totalItems,
            deviceId: this.deviceId
        };
        
        this.salesLog.push(saleEntry);
        this.saveToStorage();
        
        console.log(`💰 Продажа ${saleEntry.saleId}: ${saleEntry.totalAmount} руб`);
        
        return saleEntry;
    }

    // Сохранение в localStorage
    saveToStorage() {
        try {
            const storageKey = `gamezone_logs_${this.deviceId}`;
            localStorage.setItem(storageKey, JSON.stringify({
                deviceId: this.deviceId,
                appLog: this.appLog.slice(-500),
                salesLog: this.salesLog.slice(-1000),
                lastUpdated: new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ Ошибка сохранения логов:', error);
        }
    }

    // Загрузка из localStorage
    loadFromStorage() {
        try {
            const storageKey = `gamezone_logs_${this.deviceId}`;
            const saved = localStorage.getItem(storageKey);
            
            if (saved) {
                const data = JSON.parse(saved);
                this.appLog = data.appLog || [];
                this.salesLog = data.salesLog || [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки логов:', error);
        }
    }

    // Скачивание логов
    downloadLogs() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const filename = `gamezone_sales_all_${today}.txt`;
            
            let logContent = '═══════════════════════════════════════════════════════════════\n';
            logContent += '                     GAME ZONE - ПОЛНЫЕ ЛОГИ ПРОДАЖ\n';
            logContent += `          Сформировано: ${new Date().toLocaleString('ru-RU')}\n`;
            logContent += `          Устройство: ${this.deviceId}\n`;
            logContent += `          Версия: ${APP_VERSION}\n`;
            logContent += '═══════════════════════════════════════════════════════════════\n\n';
            
            const stats = this.getStats();
            logContent += '📊 ПОЛНАЯ СТАТИСТИКА ПРОДАЖ:\n';
            logContent += '───────────────────────────────────────────────────────────────\n';
            logContent += `Всего продаж: ${stats.totalSales}\n`;
            logContent += `Всего товаров: ${stats.totalItems} шт\n`;
            logContent += `Общая выручка: ${this.formatPrice(stats.totalRevenue)} руб\n\n`;
            
            // Статистика по дням
            const salesByDate = {};
            this.salesLog.forEach(sale => {
                const date = new Date(sale.timestamp).toLocaleDateString('ru-RU');
                if (!salesByDate[date]) {
                    salesByDate[date] = { count: 0, revenue: 0, items: 0 };
                }
                salesByDate[date].count++;
                salesByDate[date].revenue += sale.totalAmount;
                salesByDate[date].items += sale.totalItems;
            });
            
            logContent += '📅 СТАТИСТИКА ПО ДНЯМ:\n';
            logContent += '───────────────────────────────────────────────────────────────\n';
            Object.keys(salesByDate).sort().reverse().forEach(date => {
                const stats = salesByDate[date];
                logContent += `${date}: ${stats.count} продаж, ${stats.items} шт, ${this.formatPrice(stats.revenue)} руб\n`;
            });
            
            logContent += '\n═══════════════════════════════════════════════════════════════\n';
            logContent += '                     ПОЛНАЯ ИСТОРИЯ ПРОДАЖ\n';
            logContent += '═══════════════════════════════════════════════════════════════\n\n';
            
            // Группируем продажи по дням
            const groupedSales = {};
            this.salesLog.forEach(sale => {
                const date = new Date(sale.timestamp).toLocaleDateString('ru-RU');
                if (!groupedSales[date]) groupedSales[date] = [];
                groupedSales[date].push(sale);
            });
            
            // Сортируем дни по убыванию
            Object.keys(groupedSales).sort().reverse().forEach(date => {
                const daySales = groupedSales[date];
                const dayRevenue = daySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
                const dayItems = daySales.reduce((sum, sale) => sum + sale.totalItems, 0);
                
                logContent += `\n${'═'.repeat(60)}\n`;
                logContent += `  ДЕНЬ: ${date} (${daySales.length} продаж, ${dayItems} шт, ${this.formatPrice(dayRevenue)} руб)\n`;
                logContent += `${'═'.repeat(60)}\n\n`;
                
                daySales.forEach(sale => {
                    const saleDate = new Date(sale.timestamp).toLocaleString('ru-RU');
                    const deviceInfo = sale.deviceId ? ` [${sale.deviceId}]` : '';
                    
                    logContent += `┌─────────────────────────────────────────────────────────────┐\n`;
                    logContent += `│ ПРОДАЖА: ${sale.saleId}${deviceInfo}\n`;
                    logContent += `│ ВРЕМЯ:  ${saleDate}\n`;
                    logContent += `├─────────────────────────────────────────────────────────────┤\n`;
                    
                    sale.items.forEach((item, idx) => {
                        logContent += `│ ${idx + 1}. ${item.name} (${item.platform})\n`;
                        logContent += `│    ${item.quantity} шт × ${this.formatPrice(item.price)} руб = ${this.formatPrice(item.total)} руб\n`;
                    });
                    
                    logContent += `├─────────────────────────────────────────────────────────────┤\n`;
                    logContent += `│ ИТОГО: ${sale.totalItems} шт на сумму ${this.formatPrice(sale.totalAmount)} руб\n`;
                    logContent += `└─────────────────────────────────────────────────────────────┘\n\n`;
                });
            });
            
            const blob = new Blob(['\uFEFF' + logContent], { 
                type: 'text/plain;charset=utf-8' 
            });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('📥 Полные логи скачаны');
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка скачивания логов:', error);
            alert('Ошибка при скачивании логов');
            return false;
        }
    }

    // Очистка всех логов
    clearLogs() {
        if (confirm('Вы уверены, что хотите удалить ВСЕ логи со ВСЕХ устройств?')) {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('gamezone_logs_')) {
                        localStorage.removeItem(key);
                    }
                }
                
                this.appLog = [];
                this.salesLog = [];
                
                console.log('🗑️ Все логи очищены');
                alert('Все логи успешно очищены');
                return true;
            } catch (error) {
                console.error('❌ Ошибка очистки логов:', error);
                return false;
            }
        }
        return false;
    }

    // Получение статистики
    getStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySales = this.salesLog.filter(sale => 
            new Date(sale.timestamp) >= today
        );
        
        const totalRevenue = this.salesLog.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalItems = this.salesLog.reduce((sum, sale) => sum + sale.totalItems, 0);
        const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const todayItems = todaySales.reduce((sum, sale) => sum + sale.totalItems, 0);
        
        return {
            totalSales: this.salesLog.length,
            totalRevenue,
            totalItems,
            todaySales: todaySales.length,
            todayRevenue,
            todayItems
        };
    }

    // Продажи за период
    getSalesByPeriod(period) {
        const now = new Date();
        let startDate = new Date();
        
        switch(period) {
            case 'today-sales':
            case 'today-revenue':
            case 'today-items':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'total-sales':
            case 'total-revenue':
            case 'total-items':
                startDate = new Date(0);
                break;
            default:
                startDate.setHours(0, 0, 0, 0);
        }
        
        if (period.includes('today')) {
            return this.salesLog.filter(sale => new Date(sale.timestamp) >= startDate);
        } else {
            return this.salesLog;
        }
    }

    // Форматирование цены
    formatPrice(price) {
        if (!price) return '0';
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
}

// =============================================
// ОСНОВНОЙ КЛАСС ПРИЛОЖЕНИЯ
// =============================================

class GameScannerApp {
    constructor() {
        this.sheetsUrl = 'https://docs.google.com/spreadsheets/d/1fMWJan1HP7tcKwa_hm86oCm0KPtC_zN50UhU72Q8xeA/export?format=csv&gid=1995791598';
        this.localDataKey = 'gameZoneGamesData';
        this.scannedGamesKey = 'gameZoneScannedGames';
        
        this.gamesData = [];
        this.scannedGames = [];
        
        this.cameraStream = null;
        this.quaggaInitialized = false;
        this.isScanning = false;
        this.lastScannedCode = null;
        this.scanCooldown = false;
        this.lastScanTime = 0;
        
        this.appVersion = APP_VERSION;
        this.isClientMode = isClientMode;
        this.logger = new SimpleLogger();
        
        // Переменные для оптимизации
        this.searchTimeout = null;
        this.searchScrollPosition = 0;
        
        this.init();
    }

    // Инициализация приложения
    async init() {
        console.log(`⚔️ GAME ZONE Scanner ${this.appVersion} запущен`);
        console.log(`📱 Режим: ${this.isClientMode ? 'КЛИЕНТСКИЙ' : 'ПОЛНЫЙ'}`);
        console.log(`📱 ID устройства: ${DEVICE_ID}`);
        
        // Трекинг запуска
        this.trackUsage('APP_START', { 
            mode: this.isClientMode ? 'client' : 'full',
            urlMode: urlParams.get('mode')
        });
        
        this.setMode(this.isClientMode);
        this.setupEventListeners();
        
        this.updateStatus('🌐 Загружаем данные...');
        await this.loadGamesData();
    }

    // Установка режима работы
    setMode(isClientMode) {
        this.isClientMode = isClientMode;
        localStorage.setItem('gamezone_mode', isClientMode ? 'client' : 'full');
        
        const container = document.getElementById('app-container');
        const modeIndicator = document.getElementById('mode-indicator');
        const modeStatus = document.getElementById('mode-status');
        const appSubtitle = document.getElementById('app-subtitle');
        const scannerText = document.getElementById('scanner-text');
        const switchBtn = document.getElementById('switch-mode-btn');
        
        if (isClientMode) {
            container.classList.add('client-mode');
            modeIndicator.style.display = 'block';
            modeStatus.textContent = 'КЛИЕНТ';
            appSubtitle.textContent = 'Сканер цен для клиентов';
            scannerText.textContent = 'Наведите камеру на штрих-код игры';
            switchBtn.style.display = 'block';
            switchBtn.textContent = '👨‍💻 Режим разработчика';
            switchBtn.classList.remove('switch-mode');
            switchBtn.classList.add('developer-mode');
        } else {
            container.classList.remove('client-mode');
            modeIndicator.style.display = 'none';
            modeStatus.textContent = 'ПОЛНЫЙ';
            appSubtitle.textContent = 'Сканер игровых дисков';
            scannerText.textContent = 'Нажмите для запуска сканера';
            switchBtn.style.display = 'block';
            switchBtn.textContent = '👤 Переключить на клиентский режим';
            switchBtn.classList.add('switch-mode');
            switchBtn.classList.remove('developer-mode');
        }
        
        this.trackUsage('MODE_CHANGED', { mode: isClientMode ? 'client' : 'full' });
    }

    // Переключение режима
    toggleMode() {
        if (this.isClientMode) {
            this.setMode(false);
            this.updateStatus('✅ Переключен в режим разработчика', 'success');
        } else {
            this.setMode(true);
            this.updateStatus('✅ Переключен в клиентский режим', 'success');
        }
    }

    // Обновление статуса
    updateStatus(message, type = '') {
        const statusEl = document.getElementById('status');
        const statusText = document.getElementById('status-text');
        
        statusText.textContent = message;
        statusEl.className = 'status';
        
        if (type === 'error') statusEl.classList.add('error');
        else if (type === 'success') statusEl.classList.add('success');
        
        if (type !== '') {
            setTimeout(() => {
                const spinner = statusEl.querySelector('.loading-spinner');
                if (spinner) spinner.style.display = 'none';
            }, 500);
        }
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Основные кнопки
        document.getElementById('scanner-container').addEventListener('click', () => this.startScanner());
        document.getElementById('open-search-btn').addEventListener('click', () => this.openSearchModal());
        document.getElementById('sale-btn').addEventListener('click', () => this.openCartModal());
        document.getElementById('stats-btn').addEventListener('click', () => this.openStatsModal());
        document.getElementById('switch-mode-btn').addEventListener('click', () => this.toggleMode());
        
        // Управление логами
        document.getElementById('download-logs-btn').addEventListener('click', () => this.downloadLogs());
        document.getElementById('clear-logs-btn').addEventListener('click', () => this.clearLogs());
        
        // Закрытие модальных окон
        document.getElementById('close-cart-btn').addEventListener('click', () => this.closeModal('cart-modal'));
        document.getElementById('close-search-btn').addEventListener('click', () => this.closeModal('search-modal'));
        document.getElementById('close-camera-btn').addEventListener('click', () => this.stopScanner());
        document.getElementById('stop-camera').addEventListener('click', () => this.stopScanner());
        document.getElementById('close-stats-btn').addEventListener('click', () => this.closeModal('stats-modal'));
        document.getElementById('close-stats-detail-btn').addEventListener('click', () => this.closeModal('stats-detail-modal'));
        document.getElementById('modal-overlay').addEventListener('click', () => this.closeAllModals());
        document.getElementById('back-to-stats-btn').addEventListener('click', () => {
            this.closeModal('stats-detail-modal');
            this.openModal('stats-modal');
        });
        
        // Камера
        document.getElementById('restart-camera').addEventListener('click', () => {
            console.log('🔄 Перезапуск камеры');
            this.restartCamera();
        });
        
        // Поиск с debounce
        const searchInput = document.getElementById('smart-search-input');
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.performSmartSearch(e.target.value);
            }, SEARCH_DEBOUNCE_MS);
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                const results = this.performSmartSearch(e.target.value);
                if (results.length > 0) {
                    this.addGameToCart(results[0]);
                    this.closeModal('search-modal');
                    e.target.value = '';
                }
            }
        });
        
        // Корзина
        document.getElementById('clear-cart-btn').addEventListener('click', () => this.clearCart());
        document.getElementById('process-sale-btn').addEventListener('click', () => this.processSaleFromCart());
        
        // Кликабельная статистика
        document.addEventListener('click', (e) => {
            if (e.target.closest('.stat-card')) {
                const card = e.target.closest('.stat-card');
                const statType = card.getAttribute('data-stat');
                if (statType) this.showStatDetails(statType);
            }
        });
    }

    // =============================================
    // ЗАГРУЗКА И ОБРАБОТКА ДАННЫХ
    // =============================================

    async loadGamesData() {
        try {
            this.updateStatus('🌐 Проверяем обновления...');
            const hasInternetUpdate = await this.checkForUpdates();
            
            if (hasInternetUpdate && this.gamesData.length > 0) {
                this.updateStatus(`✅ Обновлено! ${this.gamesData.length} игр`, 'success');
                this.trackUsage('DATA_UPDATED', { count: this.gamesData.length });
            } else {
                this.loadFromLocalStorage();
                
                if (this.gamesData.length === 0) {
                    this.createSampleData();
                    this.updateStatus('✅ Загружены демо-данные', 'success');
                    this.trackUsage('DEMO_DATA_LOADED', { count: this.gamesData.length });
                } else {
                    this.updateStatus(`✅ Готов! ${this.gamesData.length} игр в базе`, 'success');
                }
            }
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            if (this.gamesData.length === 0) {
                this.createSampleData();
                this.updateStatus('⚠️ Используем демо-данные', 'error');
            }
        }
    }

    // Проверка обновлений из Google Sheets
    async checkForUpdates() {
        try {
            console.log('🔄 Проверяем обновления...');
            
            const response = await fetch(this.sheetsUrl + '&t=' + Date.now());
            if (!response.ok) throw new Error('Ошибка сети');
            
            const csvText = await response.text();
            if (!csvText || csvText.length < 100) {
                console.log('⚠️ Пустые данные от сервера');
                return false;
            }
            
            const newData = this.parseCSV(csvText);
            if (newData.length > 0) {
                this.gamesData = newData;
                this.saveToLocalStorage();
                console.log(`🔄 Обновлено ${this.gamesData.length} игр`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.log('⚠️ Не удалось обновить данные:', error);
            return false;
        }
    }

    // Загрузка из localStorage
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem(this.localDataKey);
            const savedCart = localStorage.getItem(this.scannedGamesKey);
            
            if (savedData) {
                this.gamesData = JSON.parse(savedData);
                console.log(`📊 Загружено ${this.gamesData.length} игр из кэша`);
            }
            
            if (savedCart) {
                this.scannedGames = JSON.parse(savedCart);
                console.log(`🛒 Загружено ${this.scannedGames.length} товаров в корзине`);
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.gamesData = [];
            this.scannedGames = [];
        }
    }

    // Демо-данные
    createSampleData() {
        this.gamesData = [
            {
                platform: 'PS4',
                barcode: '711719803278',
                name: 'The Last of Us Part II',
                code: 'CUSA-18278',
                language: 'RUS',
                optPrice: '1999',
                marketplace: '2499',
                codeType: 'CUSA'
            },
            {
                platform: 'PS5',
                barcode: '711719998653',
                name: 'Spider-Man: Miles Morales',
                code: 'PPSA-01462',
                language: 'RUS',
                optPrice: '2499',
                marketplace: '3499',
                codeType: 'PPSA'
            },
            {
                platform: 'NS',
                barcode: '045496873285',
                name: 'The Legend of Zelda: Breath of the Wild',
                code: '',
                language: 'ENG',
                optPrice: '2999',
                marketplace: '3999',
                codeType: ''
            },
            {
                platform: 'XBOX ONE',
                barcode: '889842414205',
                name: 'Halo Infinite',
                code: '',
                language: 'RUS',
                optPrice: '2299',
                marketplace: '3299',
                codeType: ''
            }
        ];
        
        this.saveToLocalStorage();
    }

    // Парсинг CSV
    parseCSV(csvText) {
        const games = [];
        const rows = csvText.split('\n');
        
        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            try {
                const cells = this.parseCSVRow(rows[i]);
                if (cells.length < 29) continue;

                // PS4
                if (cells[0]?.includes('PS4') && cells[1] && cells[2]) {
                    games.push({
                        platform: cells[0],
                        barcode: cells[1],
                        name: cells[2],
                        code: cells[3] || '',
                        language: cells[4] || '',
                        optPrice: cells[5] || '',
                        marketplace: cells[6] || '',
                        codeType: 'CUSA'
                    });
                }
                
                // PS5
                if (cells[8]?.includes('PS5') && cells[9] && cells[10]) {
                    games.push({
                        platform: cells[8],
                        barcode: cells[9],
                        name: cells[10],
                        code: cells[11] || '',
                        language: cells[12] || '',
                        optPrice: cells[13] || '',
                        marketplace: cells[14] || '',
                        codeType: 'PPSA'
                    });
                }
                
                // Nintendo Switch
                if (cells[16] && (cells[16].includes('NS') || cells[16].includes('Switch')) && cells[17] && cells[18]) {
                    let barcodes = cells[17];
                    if (barcodes.includes('/')) {
                        barcodes = barcodes.split('/').map(b => b.trim()).join('/');
                    }
                    
                    games.push({
                        platform: cells[16],
                        barcode: barcodes,
                        name: cells[18],
                        code: '',
                        language: cells[19] || '',
                        optPrice: cells[20] || '',
                        marketplace: cells[21] || '',
                        codeType: ''
                    });
                }
                
                // Xbox
                if (cells[23]?.includes('XBOX') && cells[24] && cells[25]) {
                    games.push({
                        platform: cells[23],
                        barcode: cells[24],
                        name: cells[25],
                        code: '',
                        language: cells[26] || '',
                        optPrice: cells[27] || '',
                        marketplace: cells[28] || '',
                        codeType: ''
                    });
                }
            } catch (error) {
                console.log('Ошибка парсинга строки', i, error);
            }
        }
        
        return games;
    }

    parseCSVRow(row) {
        const cells = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of row) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        cells.push(current.trim());
        return cells;
    }

    // Сохранение в localStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem(this.localDataKey, JSON.stringify(this.gamesData));
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
        }
    }

    saveCart() {
        try {
            localStorage.setItem(this.scannedGamesKey, JSON.stringify(this.scannedGames));
        } catch (error) {
            console.error('Ошибка сохранения корзины:', error);
        }
    }

    // =============================================
    // УПРАВЛЕНИЕ МОДАЛЬНЫМИ ОКНАМИ
    // =============================================

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        document.getElementById('modal-overlay').style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Виброотклик
        this.hapticFeedback('light');
        
        // Восстановление скролла для поиска
        if (modalId === 'search-modal') {
            setTimeout(() => {
                const resultsContainer = document.getElementById('smart-search-results');
                if (resultsContainer) {
                    resultsContainer.scrollTop = this.searchScrollPosition;
                }
            }, 50);
        }
    }

    closeModal(modalId) {
        // Сохранение позиции скролла для поиска
        if (modalId === 'search-modal') {
            const resultsContainer = document.getElementById('smart-search-results');
            if (resultsContainer) {
                this.searchScrollPosition = resultsContainer.scrollTop;
            }
        }
        
        document.getElementById(modalId).style.display = 'none';
        document.getElementById('modal-overlay').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.getElementById('modal-overlay').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // =============================================
    // КОРЗИНА И ПРОДАЖИ
    // =============================================

    openCartModal() {
        if (this.scannedGames.length === 0) {
            alert('🛒 Корзина пуста');
            return;
        }
        
        this.renderCart();
        this.openModal('cart-modal');
    }

    renderCart() {
        const cartItems = document.getElementById('cart-items');
        cartItems.innerHTML = '';
        
        let total = 0;
        let totalItems = 0;
        
        this.scannedGames.forEach((game, index) => {
            const quantity = game.quantity || 1;
            const itemTotal = game.price * quantity;
            total += itemTotal;
            totalItems += quantity;
            
            const item = document.createElement('div');
            item.className = 'cart-item';
            item.innerHTML = `
                <div class="cart-item-header">
                    <div class="cart-item-info">
                        <div class="cart-item-name">
                            ${this.getPlatformIconOnly(game.platform)}
                            <span>${game.name}</span>
                        </div>
                    </div>
                </div>
                <div class="cart-item-controls">
                    <div class="cart-item-quantity">
                        <button class="quantity-btn minus" data-index="${index}">-</button>
                        <span class="quantity-value">${quantity}</span>
                        <button class="quantity-btn plus" data-index="${index}">+</button>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <div class="cart-item-price">${this.formatPrice(itemTotal)} руб</div>
                        <button class="cart-remove" data-index="${index}">×</button>
                    </div>
                </div>
            `;
            
            // Обработчики с виброоткликом
            const addVibration = (e) => {
                e.stopPropagation();
                this.hapticFeedback('light');
                this.updateCartItem(index, 1);
            };
            
            const removeVibration = (e) => {
                e.stopPropagation();
                this.hapticFeedback('light');
                this.updateCartItem(index, -1);
            };
            
            const deleteVibration = (e) => {
                e.stopPropagation();
                this.hapticFeedback('medium');
                this.removeFromCart(index);
            };
            
            item.querySelector('.plus').addEventListener('click', addVibration);
            item.querySelector('.minus').addEventListener('click', removeVibration);
            item.querySelector('.cart-remove').addEventListener('click', deleteVibration);
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('quantity-btn') && !e.target.classList.contains('cart-remove')) {
                    this.displayGameInfo(game.fullInfo);
                    this.closeModal('cart-modal');
                }
            });
            
            cartItems.appendChild(item);
        });
        
        document.getElementById('cart-total-amount').textContent = this.formatPrice(total);
        document.getElementById('sale-btn').textContent = `💰 ОФОРМИТЬ ПРОДАЖУ (${totalItems} шт - ${this.formatPrice(total)} руб)`;
    }

    addGameToCart(game) {
        const price = this.calculateFinalPrice(game.optPrice);
        const existingIndex = this.scannedGames.findIndex(g => g.barcode === game.barcode);
        
        if (existingIndex !== -1) {
            this.scannedGames[existingIndex].quantity = (this.scannedGames[existingIndex].quantity || 1) + 1;
        } else {
            this.scannedGames.push({
                name: game.name,
                barcode: game.barcode,
                price: price,
                platform: game.platform,
                platformIcon: this.getPlatformIconOnly(game.platform),
                fullInfo: game,
                quantity: 1
            });
        }
        
        this.saveCart();
        this.displayGameInfo(game);
        this.updateStatus('✅ Игра добавлена в корзину', 'success');
        this.hapticFeedback('medium');
        
        this.trackUsage('GAME_ADDED_TO_CART', { name: game.name, price: price });
    }

    updateCartItem(index, change) {
        if (index >= 0 && index < this.scannedGames.length) {
            const currentQuantity = this.scannedGames[index].quantity || 1;
            const newQuantity = currentQuantity + change;
            
            if (newQuantity < 1) {
                this.removeFromCart(index);
            } else {
                this.scannedGames[index].quantity = newQuantity;
                this.saveCart();
                this.renderCart();
            }
        }
    }

    removeFromCart(index) {
        if (index >= 0 && index < this.scannedGames.length) {
            this.scannedGames.splice(index, 1);
            this.saveCart();
            this.renderCart();
        }
    }

    clearCart() {
        if (this.scannedGames.length === 0) return;
        
        if (confirm('Очистить всю корзину?')) {
            this.scannedGames = [];
            this.saveCart();
            this.renderCart();
            this.closeModal('cart-modal');
            this.updateStatus('✅ Корзина очищена', 'success');
            this.hapticFeedback('heavy');
        }
    }

    processSaleFromCart() {
        const totalAmount = this.scannedGames.reduce((sum, game) => sum + (game.price * (game.quantity || 1)), 0);
        const totalItems = this.scannedGames.reduce((sum, game) => sum + (game.quantity || 1), 0);
        
        const confirmText = `Подтвердить продажу?\n\n` +
            `Товаров: ${totalItems} шт\n` +
            `Сумма: ${this.formatPrice(totalAmount)} руб`;
        
        if (!confirm(confirmText)) return;
        
        const saleData = {
            items: this.scannedGames.map(game => ({
                name: game.name,
                platform: game.platform,
                price: game.price,
                quantity: game.quantity || 1,
                total: game.price * (game.quantity || 1)
            })),
            totalAmount: totalAmount,
            totalItems: totalItems
        };
        
        const saleEntry = this.logger.logSale(saleData);
        
        alert(`✅ Продажа оформлена!\n\n` +
              `ID: ${saleEntry.saleId}\n` +
              `Товаров: ${totalItems} шт\n` +
              `Сумма: ${this.formatPrice(totalAmount)} руб`);
        
        this.scannedGames = [];
        this.saveCart();
        this.closeModal('cart-modal');
        this.updateStatus('✅ Продажа завершена', 'success');
        this.hapticFeedback('heavy');
        
        this.trackUsage('SALE_COMPLETED', { 
            saleId: saleEntry.saleId, 
            amount: totalAmount, 
            items: totalItems 
        });
    }

    // =============================================
    // ПОИСК И СТАТИСТИКА
    // =============================================

    openSearchModal() {
        this.openModal('search-modal');
        document.getElementById('smart-search-input').value = '';
        document.getElementById('smart-search-results').innerHTML = 
            '<div style="padding: 20px; text-align: center; color: #a0a0c0;">Введите запрос для поиска игр</div>';
    }

    performSmartSearch(query) {
        const resultsContainer = document.getElementById('smart-search-results');
        
        if (!query || query.length < 2) {
            resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #a0a0c0;">Введите минимум 2 символа</div>';
            return [];
        }
        
        const results = this.logger.smartSearch(this.gamesData, query);
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #a0a0c0;">Игры не найдены</div>';
            return [];
        }
        
        resultsContainer.innerHTML = '';
        results.slice(0, 15).forEach(game => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="search-result-name">
                    ${this.getPlatformIconOnly(game.platform)}
                    <span>${game.name}</span>
                </div>
                <div class="search-result-details">
                    <span></span>
                    <span class="search-result-price">${this.formatPrice(this.calculateFinalPrice(game.optPrice))} руб</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.addGameToCart(game);
                this.closeModal('search-modal');
                document.getElementById('smart-search-input').value = '';
            });
            
            resultsContainer.appendChild(item);
        });
        
        this.trackUsage('SEARCH_PERFORMED', { query: query, results: results.length });
        return results;
    }

    openStatsModal() {
        const stats = this.logger.getStats();
        const today = new Date().toLocaleDateString('ru-RU');
        
        document.getElementById('stats-date').textContent = today;
        document.getElementById('today-sales').textContent = stats.todaySales;
        document.getElementById('today-revenue').textContent = this.formatPrice(stats.todayRevenue) + ' руб';
        document.getElementById('today-items').textContent = stats.todayItems;
        document.getElementById('total-sales').textContent = stats.totalSales;
        document.getElementById('total-revenue').textContent = this.formatPrice(stats.totalRevenue) + ' руб';
        document.getElementById('total-items').textContent = stats.totalItems;
        
        this.openModal('stats-modal');
    }

    showStatDetails(statType) {
        const stats = this.logger.getStats();
        const sales = this.logger.getSalesByPeriod(statType);
        
        let title = '';
        let periodText = '';
        
        switch(statType) {
            case 'today-sales':
                title = '📋 Продажи за сегодня';
                periodText = `Сегодня (${new Date().toLocaleDateString('ru-RU')})`;
                break;
            case 'today-revenue':
                title = '💰 Выручка за сегодня';
                periodText = `Сегодня (${new Date().toLocaleDateString('ru-RU')})`;
                break;
            case 'today-items':
                title = '🛍️ Товары за сегодня';
                periodText = `Сегодня (${new Date().toLocaleDateString('ru-RU')})`;
                break;
            case 'total-sales':
                title = '📊 Все продажи';
                periodText = 'За все время';
                break;
            case 'total-revenue':
                title = '💵 Общая выручка';
                periodText = 'За все время';
                break;
            case 'total-items':
                title = '📦 Все товары';
                periodText = 'За все время';
                break;
            default:
                title = '📋 Детали продаж';
                periodText = 'Детали';
        }
        
        document.getElementById('stats-detail-title').textContent = title;
        document.getElementById('stats-detail-period').textContent = periodText;
        
        const detailContent = document.getElementById('stats-detail-content');
        detailContent.innerHTML = '';
        
        if (sales.length === 0) {
            detailContent.innerHTML = `
                <div style="padding: 30px; text-align: center; color: #a0a0c0;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                    <div style="font-size: 16px; margin-bottom: 10px;">Нет данных</div>
                    <div style="font-size: 14px; color: #888;">Продажи за этот период отсутствуют</div>
                </div>
            `;
        } else {
            sales.forEach(sale => {
                const saleDate = new Date(sale.timestamp).toLocaleString('ru-RU');
                const item = document.createElement('div');
                item.className = 'sale-detail-item';
                
                let itemsHtml = '';
                sale.items.forEach((game, idx) => {
                    itemsHtml += `
                        <div class="sale-detail-game">
                            <span>${idx + 1}.</span>
                            ${this.getPlatformIconOnly(game.platform)}
                            <span>${game.name}</span>
                            <span style="margin-left: auto; font-weight: bold;">${this.formatPrice(game.total)} руб</span>
                        </div>
                    `;
                });
                
                item.innerHTML = `
                    <div class="sale-detail-header">
                        <div class="sale-detail-id">${sale.saleId}</div>
                        <div class="sale-detail-date">${saleDate}</div>
                    </div>
                    <div class="sale-detail-items">
                        ${itemsHtml}
                    </div>
                    <div class="sale-detail-total">
                        ИТОГО: ${sale.totalItems} шт на сумму ${this.formatPrice(sale.totalAmount)} руб
                    </div>
                `;
                
                detailContent.appendChild(item);
            });
        }
        
        this.closeModal('stats-modal');
        this.openModal('stats-detail-modal');
    }

    // =============================================
    // СИСТЕМА СКАНИРОВАНИЯ (ОПТИМИЗИРОВАННАЯ)
    // =============================================

    async startScanner() {
        if (this.gamesData.length === 0) {
            alert('❌ Нет данных об играх');
            return;
        }
        
        this.trackUsage('SCAN_START', { hasCamera: true });
        this.resetScannerState();
        this.showCameraModal();
    }

    showCameraModal() {
        document.getElementById('modal-overlay').style.display = 'block';
        document.getElementById('camera-modal').style.display = 'block';
        this.initializeCamera();
    }

    updateCameraStatus(message, type = '') {
        const statusEl = document.getElementById('camera-status');
        statusEl.textContent = message;
        statusEl.className = `scanning-status ${type}`;
        statusEl.style.display = 'block';
    }

    async initializeCamera() {
        try {
            console.log('📷 Инициализация камеры...');
            
            await this.stopCamera();
            
            const constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24, max: 30 } // Оптимизация FPS
                }
            };
            
            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            document.getElementById('camera-view').srcObject = this.cameraStream;
            
            this.updateCameraStatus('🔍 Камера запущена, инициализируем сканер...');
            
            setTimeout(() => {
                this.startQuaggaScanner();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Ошибка камеры:', error);
            this.handleCameraError(error);
        }
    }

    startQuaggaScanner() {
        if (this.isScanning) return;
        
        console.log('🎯 Запуск Quagga сканера');
        
        this.stopQuagga();
        
        const config = {
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.getElementById('camera-view'),
                constraints: {
                    width: 640,
                    height: 480
                }
            },
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "code_128_reader"]
            },
            locate: true,
            frequency: 10
        };
        
        Quagga.init(config, (err) => {
            if (err) {
                console.error('❌ Ошибка инициализации Quagga:', err);
                this.updateCameraStatus('❌ Ошибка сканера', 'scanning-error');
                this.safeRestartScanner();
                return;
            }
            
            console.log('✅ Quagga успешно инициализирован');
            this.quaggaInitialized = true;
            this.isScanning = true;
            
            Quagga.start();
            this.updateCameraStatus('🔍 Сканирую штрих-коды...');
            
            Quagga.onDetected((result) => {
                if (this.isScanning && !this.scanCooldown) {
                    this.handleBarcodeDetection(result);
                }
            });
        });
    }

    handleBarcodeDetection(result) {
        if (!result.codeResult?.code) return;
        
        const code = result.codeResult.code.toString().trim();
        console.log('📷 Сканирован код:', code);
        
        // Проверка длины кода
        if (code.length < 6) return;
        
        // Проверка таймаута между сканированиями
        const now = Date.now();
        if (this.lastScanTime && (now - this.lastScanTime) < SCAN_COOLDOWN_MS) {
            console.log('⏱️ Слишком быстрое сканирование, пропускаем');
            return;
        }
        
        // Проверка на повторный код
        if (this.lastScannedCode === code) {
            console.log('🔄 Повторный код, пропускаем');
            return;
        }
        
        this.lastScanTime = now;
        this.scanCooldown = true;
        this.lastScannedCode = code;
        this.stopQuagga();
        
        this.updateCameraStatus(`📷 Найден код: ${code}`, 'scanning-success');
        this.processScannedBarcode(code);
    }

    async processScannedBarcode(barcode) {
        const code = barcode.toString().trim();
        
        console.log('🔍 Ищем игру для кода:', code);
        const game = this.findGameByBarcode(code);
        
        if (game) {
            console.log('✅ Найдена игра:', game.name);
            
            if (this.isClientMode) {
                this.displayGameInfo(game);
                this.updateCameraStatus('✅ Цена найдена!', 'scanning-success');
            } else {
                this.addGameToCart(game);
                this.updateCameraStatus('✅ Игра найдена!', 'scanning-success');
            }
            
            this.hapticFeedback('medium');
            this.trackUsage('SCAN_SUCCESS', { barcode: code, game: game.name });
            
            setTimeout(() => {
                this.stopScanner();
                this.scanCooldown = false;
                this.lastScannedCode = null;
            }, 1000);
            
        } else {
            console.log('❌ Игра не найдена для кода:', code);
            this.updateCameraStatus('❌ Игра не найдена', 'scanning-error');
            
            this.hapticFeedback('heavy');
            this.trackUsage('SCAN_FAILED', { barcode: code });
            
            setTimeout(() => {
                this.resetScannerStateForRestart();
                this.safeRestartScanner();
            }, 300);
        }
    }

    findGameByBarcode(barcode) {
        const cleanBarcode = barcode.toString().trim();
        
        // Прямое совпадение
        let game = this.gamesData.find(g => {
            if (!g.barcode) return false;
            if (g.barcode.includes('/')) {
                const barcodes = g.barcode.split('/').map(b => b.trim());
                return barcodes.includes(cleanBarcode);
            }
            return g.barcode === cleanBarcode;
        });
        
        // Частичное совпадение
        if (!game) {
            game = this.gamesData.find(g => {
                if (!g.barcode) return false;
                if (g.barcode.includes('/')) {
                    const barcodes = g.barcode.split('/').map(b => b.trim());
                    return barcodes.some(b => cleanBarcode.includes(b) || b.includes(cleanBarcode));
                }
                return g.barcode.includes(cleanBarcode) || cleanBarcode.includes(g.barcode);
            });
        }
        
        return game;
    }

    resetScannerStateForRestart() {
        this.scanCooldown = false;
        this.lastScannedCode = null;
        this.stopQuagga();
        this.isScanning = false;
    }

    async safeRestartScanner() {
        console.log('🔄 Безопасный перезапуск сканера');
        this.updateCameraStatus('🔍 Перезапуск сканера...');
        
        try {
            this.stopQuagga();
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            if (!this.cameraStream || this.cameraStream.getTracks().every(track => track.readyState === 'ended')) {
                console.log('⚠️ Камера перестала работать, перезапускаем полностью');
                await this.restartCamera();
                return;
            }
            
            this.startQuaggaScanner();
            
        } catch (e) {
            console.error('❌ Ошибка безопасного перезапуска:', e);
            this.restartCamera();
        }
    }

    async restartCamera() {
        console.log('🔄 Полный перезапуск камеры');
        this.updateCameraStatus('🔄 Перезапускаем камеру...');
        
        this.stopQuagga();
        await this.stopCamera();
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await this.initializeCamera();
    }

    stopQuagga() {
        try {
            if (this.quaggaInitialized) {
                Quagga.offDetected();
                Quagga.stop();
                console.log('✅ Quagga остановлен');
            }
            this.quaggaInitialized = false;
        } catch (e) {
            console.log('ℹ️ Quagga уже остановлен или не был инициализирован');
        }
    }

    async stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => {
                track.stop();
            });
            this.cameraStream = null;
            console.log('✅ Камера остановлена');
        }
    }

    stopScanner() {
        console.log('🛑 Полная остановка сканера');
        
        this.resetScannerState();
        this.stopQuagga();
        this.stopCamera();
        
        document.getElementById('modal-overlay').style.display = 'none';
        document.getElementById('camera-modal').style.display = 'none';
        document.getElementById('camera-status').style.display = 'none';
        
        console.log('✅ Сканер полностью остановлен');
        this.trackUsage('SCAN_STOPPED');
    }

    handleCameraError(error) {
        let errorMessage = 'Неизвестная ошибка камеры';
        
        switch (error.name) {
            case 'NotAllowedError':
                errorMessage = '❌ Доступ к камере запрещен. Разрешите доступ в настройках браузера.';
                break;
            case 'NotFoundError':
                errorMessage = '❌ Камера не найдена. Убедитесь, что камера подключена.';
                break;
            case 'NotSupportedError':
                errorMessage = '❌ Ваш браузер не поддерживает доступ к камере.';
                break;
            case 'NotReadableError':
                errorMessage = '❌ Камера уже используется другим приложением.';
                break;
        }
        
        this.updateCameraStatus(errorMessage, 'scanning-error');
        setTimeout(() => this.stopScanner(), 3000);
    }

    resetScannerState() {
        console.log('🔄 Сброс состояния сканера');
        this.isScanning = false;
        this.lastScannedCode = null;
        this.scanCooldown = false;
        this.lastScanTime = 0;
    }

    // =============================================
    // УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // =============================================

    // Отображение информации об игре
    displayGameInfo(game) {
        const price = this.calculateFinalPrice(game.optPrice);
        
        // Обновляем цену
        document.getElementById('current-price-value').textContent = this.formatPrice(price || '0');
        document.getElementById('current-price').classList.add('visible');
        
        // Показываем детали
        const priceDetails = document.getElementById('price-details');
        const priceDetailsPlatform = document.getElementById('price-details-platform');
        const priceDetailsName = document.getElementById('price-details-name');
        
        priceDetailsPlatform.innerHTML = this.getPlatformIconOnly(game.platform);
        priceDetailsName.textContent = game.name;
        priceDetails.style.display = 'block';
        
        // Дополнительная информация для режима разработчика
        if (!this.isClientMode) {
            document.getElementById('game-language').textContent = this.getLanguageText(game.language) || '—';
            document.getElementById('game-platform').innerHTML = this.getPlatformIconOnly(game.platform);
            document.getElementById('game-barcode').textContent = game.barcode;
            document.getElementById('game-marketplace').textContent = game.marketplace || '—';
            
            const codeRow = document.getElementById('game-code-row');
            if (game.code && game.codeType) {
                document.getElementById('game-code-label').textContent = game.codeType + ':';
                document.getElementById('game-code').textContent = game.code;
                codeRow.style.display = 'flex';
            } else {
                codeRow.style.display = 'none';
            }
            
            document.getElementById('game-info').classList.add('visible');
        }
        
        this.trackUsage('GAME_DISPLAYED', { 
            name: game.name, 
            price: price,
            mode: this.isClientMode ? 'client' : 'full'
        });
    }

    // Расчет окончательной цены
    calculateFinalPrice(optPrice) {
        if (!optPrice) return 0;
        try {
            const clean = optPrice.replace(',', '.').replace(/\s/g, '');
            const price = parseFloat(clean);
            return isNaN(price) ? 0 : Math.round(price + 1000);
        } catch {
            return 0;
        }
    }

    // Иконки платформ
    getPlatformIconOnly(platform) {
        let platformText = '';
        let platformClass = '';
        
        if (platform.includes('PS4')) {
            platformText = 'PS4';
            platformClass = 'ps4-icon';
        } else if (platform.includes('PS5')) {
            platformText = 'PS5';
            platformClass = 'ps5-icon';
        } else if (platform.includes('NS') || platform.includes('Switch')) {
            platformText = 'NS';
            platformClass = 'ns-icon';
        } else if (platform.includes('XBOX')) {
            platformText = 'XB';
            platformClass = 'xbox-icon';
        } else {
            platformText = platform;
            platformClass = 'ps4-icon';
        }
        
        return `<span class="platform-icon ${platformClass}">${platformText}</span>`;
    }

    // Текст языка
    getLanguageText(lang) {
        const map = {
            'ENG': 'Английский', 
            'SUB': 'Русские субтитры', 
            'RUS': 'Русский', 
            'MULTI': 'Мульти язык'
        };
        return map[lang?.toUpperCase()] || lang || '';
    }

    // Форматирование цены с пробелами
    formatPrice(price) {
        if (!price) return '0';
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    // Виброотклик
    hapticFeedback(type = 'light') {
        if (!navigator.vibrate) return;
        
        const patterns = {
            'light': 50,
            'medium': 100,
            'heavy': [100, 50, 100]
        };
        
        navigator.vibrate(patterns[type] || 50);
    }

    // Трекинг использования
    trackUsage(action, data = {}) {
        try {
            const usageData = {
                timestamp: new Date().toISOString(),
                action: action,
                data: data,
                version: APP_VERSION,
                mode: this.isClientMode ? 'client' : 'full',
                deviceId: DEVICE_ID
            };
            
            // Сохраняем статистику за день
            const today = new Date().toISOString().split('T')[0];
            const usageKey = `gamezone_usage_${today}`;
            const todayUsage = JSON.parse(localStorage.getItem(usageKey) || '[]');
            todayUsage.push(usageData);
            
            // Ограничиваем размер
            if (todayUsage.length > 100) {
                todayUsage.splice(0, todayUsage.length - 100);
            }
            
            localStorage.setItem(usageKey, JSON.stringify(todayUsage));
            
        } catch (error) {
            console.error('❌ Ошибка трекинга:', error);
        }
    }

    // Управление логами
    downloadLogs() {
        const success = this.logger.downloadLogs();
        if (success) {
            this.updateStatus('✅ Все логи скачаны', 'success');
            this.hapticFeedback('medium');
            this.trackUsage('LOGS_DOWNLOADED');
        }
    }

    clearLogs() {
        const success = this.logger.clearLogs();
        if (success) {
            this.updateStatus('✅ Все логи очищены', 'success');
            this.hapticFeedback('heavy');
            this.trackUsage('LOGS_CLEARED');
        }
    }
}

// =============================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    // Проверяем поддержку Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(() => {
            console.log('✅ Service Worker готов');
        }).catch(error => {
            console.log('⚠️ Service Worker не готов:', error);
        });
    }
    
    // Запускаем приложение
    window.gameApp = new GameScannerApp();
});

// Глобальные утилиты
window.formatPrice = function(price) {
    if (!price) return '0';
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
