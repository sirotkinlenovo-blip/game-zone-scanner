// Константы и глобальные переменные
const DEVELOPER_PASSWORD = '123321';
let isDeveloperMode = localStorage.getItem('developerMode') === 'true';
let stream = null;
let currentCameraIndex = 0;
let cameras = [];
let scanResults = JSON.parse(localStorage.getItem('scanResults')) || [];
let autoSave = true;
let soundEnabled = true;
let vibrationEnabled = true;

// Элементы разработчика
const developerModeEl = document.getElementById('developerMode');
const clientModeEl = document.getElementById('clientMode');
const modeToggle = document.getElementById('modeToggle');
const qrVideo = document.getElementById('qrVideo');
const startScannerBtn = document.getElementById('startScanner');
const stopScannerBtn = document.getElementById('stopScanner');
const switchCameraBtn = document.getElementById('switchCamera');
const scanResultsEl = document.getElementById('scanResults');
const clearResultsBtn = document.getElementById('clearResults');
const exportResultsBtn = document.getElementById('exportResults');
const autoSaveCheckbox = document.getElementById('autoSave');
const soundCheckbox = document.getElementById('soundEnabled');
const vibrationCheckbox = document.getElementById('vibrationEnabled');

// Элементы клиента
const qrVideoClient = document.getElementById('qrVideoClient');
const startScannerClientBtn = document.getElementById('startScannerClient');
const stopScannerClientBtn = document.getElementById('stopScannerClient');
const clientScanResultsEl = document.getElementById('clientScanResults');

// Аудио элементы
const scanSound = document.getElementById('scanSound');
const errorSound = document.getElementById('errorSound');

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadSettings();
    updateUI();
    renderScanResults();
    setupEventListeners();
});

// Инициализация приложения
function initializeApp() {
    modeToggle.checked = isDeveloperMode;
    
    if (isDeveloperMode) {
        switchToDeveloperMode();
    } else {
        switchToClientMode();
    }
}

// Загрузка настроек
function loadSettings() {
    const savedAutoSave = localStorage.getItem('autoSave');
    const savedSound = localStorage.getItem('soundEnabled');
    const savedVibration = localStorage.getItem('vibrationEnabled');
    
    if (savedAutoSave !== null) {
        autoSave = savedAutoSave === 'true';
        autoSaveCheckbox.checked = autoSave;
    }
    
    if (savedSound !== null) {
        soundEnabled = savedSound === 'true';
        soundCheckbox.checked = soundEnabled;
    }
    
    if (savedVibration !== null) {
        vibrationEnabled = savedVibration === 'true';
        vibrationCheckbox.checked = vibrationEnabled;
    }
}

// Обновление интерфейса
function updateUI() {
    if (isDeveloperMode) {
        developerModeEl.style.display = 'block';
        clientModeEl.style.display = 'none';
    } else {
        developerModeEl.style.display = 'none';
        clientModeEl.style.display = 'block';
    }
}

// Переключение в режим разработчика
function switchToDeveloperMode() {
    isDeveloperMode = true;
    localStorage.setItem('developerMode', 'true');
    updateUI();
    stopScanner();
    stopClientScanner();
}

// Переключение в режим клиента
function switchToClientMode() {
    isDeveloperMode = false;
    localStorage.setItem('developerMode', 'false');
    updateUI();
    stopScanner();
    
    // Скрываем поле ввода пароля
    document.getElementById('passwordInput').style.display = 'none';
    document.getElementById('devPassword').value = '';
    document.getElementById('passwordError').style.display = 'none';
}

// Показать поле ввода пароля
function showPasswordInput() {
    const passwordInput = document.getElementById('passwordInput');
    const passwordError = document.getElementById('passwordError');
    
    passwordInput.style.display = 'block';
    passwordError.style.display = 'none';
    document.getElementById('devPassword').focus();
}

// Проверка пароля
function checkPassword() {
    const password = document.getElementById('devPassword').value;
    const passwordError = document.getElementById('passwordError');
    
    if (password === DEVELOPER_PASSWORD) {
        switchToDeveloperMode();
    } else {
        passwordError.style.display = 'block';
        document.getElementById('devPassword').value = '';
        document.getElementById('devPassword').focus();
        playSound('error');
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключение режима
    modeToggle.addEventListener('change', function() {
        if (this.checked) {
            switchToDeveloperMode();
        } else {
            switchToClientMode();
        }
    });
    
    // Настройки
    autoSaveCheckbox.addEventListener('change', function() {
        autoSave = this.checked;
        localStorage.setItem('autoSave', autoSave);
    });
    
    soundCheckbox.addEventListener('change', function() {
        soundEnabled = this.checked;
        localStorage.setItem('soundEnabled', soundEnabled);
    });
    
    vibrationCheckbox.addEventListener('change', function() {
        vibrationEnabled = this.checked;
        localStorage.setItem('vibrationEnabled', vibrationEnabled);
    });
    
    // Сканер разработчика
    startScannerBtn.addEventListener('click', startScanner);
    stopScannerBtn.addEventListener('click', stopScanner);
    switchCameraBtn.addEventListener('click', switchCamera);
    clearResultsBtn.addEventListener('click', clearResults);
    exportResultsBtn.addEventListener('click', exportResults);
    
    // Сканер клиента
    startScannerClientBtn.addEventListener('click', startClientScanner);
    stopScannerClientBtn.addEventListener('click', stopClientScanner);
    
    // Enter для пароля
    document.getElementById('devPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });
}

// Запуск сканера (разработчик)
async function startScanner() {
    try {
        stopScanner();
        
        const constraints = {
            video: {
                facingMode: ['environment', 'user'],
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        qrVideo.srcObject = stream;
        
        // Получаем список камер
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');
        
        startScannerBtn.disabled = true;
        stopScannerBtn.disabled = false;
        switchCameraBtn.disabled = cameras.length <= 1;
        
        // Запускаем распознавание QR кодов
        requestAnimationFrame(scanQRCode);
        
        playSound('scan');
        
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        addResult('Ошибка доступа к камере', false);
        playSound('error');
    }
}

// Остановка сканера (разработчик)
function stopScanner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    qrVideo.srcObject = null;
    
    startScannerBtn.disabled = false;
    stopScannerBtn.disabled = true;
    switchCameraBtn.disabled = true;
}

// Переключение камеры
async function switchCamera() {
    if (cameras.length <= 1) return;
    
    currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
    
    stopScanner();
    await startScanner();
}

// Запуск сканера (клиент)
async function startClientScanner() {
    try {
        stopClientScanner();
        
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        qrVideoClient.srcObject = stream;
        
        startScannerClientBtn.disabled = true;
        stopScannerClientBtn.disabled = false;
        
        // Запускаем распознавание QR кодов
        requestAnimationFrame(scanQRCodeClient);
        
        playSound('scan');
        
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        clientScanResultsEl.innerHTML = '<p class="error">Ошибка доступа к камере</p>';
        playSound('error');
    }
}

// Остановка сканера (клиент)
function stopClientScanner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    qrVideoClient.srcObject = null;
    
    startScannerClientBtn.disabled = false;
    stopScannerClientBtn.disabled = true;
}

// Распознавание QR кода (разработчик)
function scanQRCode() {
    if (!stream) return;
    
    if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = qrVideo.videoWidth;
        canvas.height = qrVideo.videoHeight;
        
        context.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            addResult(code.data, true);
            playSound('scan');
            
            if (vibrationEnabled && navigator.vibrate) {
                navigator.vibrate(200);
            }
        }
    }
    
    requestAnimationFrame(scanQRCode);
}

// Распознавание QR кода (клиент)
function scanQRCodeClient() {
    if (!stream) return;
    
    if (qrVideoClient.readyState === qrVideoClient.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = qrVideoClient.videoWidth;
        canvas.height = qrVideoClient.videoHeight;
        
        context.drawImage(qrVideoClient, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            clientScanResultsEl.innerHTML = `
                <div class="result-item success">
                    <strong>QR код распознан:</strong><br>
                    ${code.data}
                    <div class="result-time">${new Date().toLocaleTimeString()}</div>
                </div>
            `;
            playSound('scan');
            
            if (vibrationEnabled && navigator.vibrate) {
                navigator.vibrate(200);
            }
        }
    }
    
    requestAnimationFrame(scanQRCodeClient);
}

// Добавление результата
function addResult(data, success = true) {
    const result = {
        id: Date.now(),
        data: data,
        success: success,
        timestamp: new Date().toISOString()
    };
    
    scanResults.unshift(result);
    
    if (autoSave) {
        localStorage.setItem('scanResults', JSON.stringify(scanResults));
    }
    
    renderScanResults();
}

// Отображение результатов
function renderScanResults() {
    if (scanResults.length === 0) {
        scanResultsEl.innerHTML = '<p>Нет результатов сканирования</p>';
        return;
    }
    
    const resultsHtml = scanResults.slice(0, 10).map(result => `
        <div class="result-item ${result.success ? 'success' : 'error'}">
            <strong>${result.success ? '✓' : '✗'} ${result.data}</strong>
            <div class="result-time">${new Date(result.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
    
    scanResultsEl.innerHTML = resultsHtml;
}

// Очистка результатов
function clearResults() {
    if (confirm('Вы уверены, что хотите очистить все результаты?')) {
        scanResults = [];
        localStorage.removeItem('scanResults');
        renderScanResults();
        playSound('scan');
    }
}

// Экспорт результатов
function exportResults() {
    if (scanResults.length === 0) {
        alert('Нет результатов для экспорта');
        return;
    }
    
    const dataStr = JSON.stringify(scanResults, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `scan-results-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    playSound('scan');
}

// Воспроизведение звука
function playSound(type) {
    if (!soundEnabled) return;
    
    try {
        if (type === 'scan') {
            scanSound.currentTime = 0;
            scanSound.play();
        } else if (type === 'error') {
            errorSound.currentTime = 0;
            errorSound.play();
        }
    } catch (error) {
        console.error('Ошибка воспроизведения звука:', error);
    }
}

// Экспорт функций в глобальную область видимости
window.showPasswordInput = showPasswordInput;
window.checkPassword = checkPassword;
window.switchToClientMode = switchToClientMode;
