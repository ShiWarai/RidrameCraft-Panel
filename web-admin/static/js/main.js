/**
 * Основной файл JavaScript для веб-админки
 * Содержит общие функции и инициализацию
 */

// Глобальная переменная роли пользователя (устанавливается из шаблона)
// Будет установлена в index.html через window.userRole
window.userRole = window.userRole || 'guest';
const userRole = window.userRole;

// История команд
window.commandHistory = window.commandHistory || [];
window.commandHistoryIndex = window.commandHistoryIndex !== undefined ? window.commandHistoryIndex : -1;
window.currentCommandBeforeHistory = window.currentCommandBeforeHistory || '';

/**
 * Добавить строку в консоль
 */
function addConsoleLine(text, type = 'info') {
    const console = document.getElementById('console');
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    // Используем textContent для безопасности, но добавляем поддержку переносов строк
    const formattedText = text.replace(/\n/g, '<br>');
    line.innerHTML = formattedText;
    console.appendChild(line);
    // Прокрутка вниз с задержкой для корректной работы
    setTimeout(() => {
        console.scrollTop = console.scrollHeight + 1000;
    }, 50);
}

/**
 * Выход из системы
 */
function logout() {
    fetch('/api/logout', {method: 'POST'})
        .then(() => {
            window.location.href = '/';
        });
}

/**
 * Обработка нажатий клавиш в поле ввода команды
 */
window.handleKeyPress = function(event) {
    const input = document.getElementById('command-input');
    
    if (event.key === 'Enter') {
        if (typeof sendCommandFromInput === 'function') {
            sendCommandFromInput();
        }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        // Сохраняем текущую команду, если мы еще не в истории
        if (window.commandHistoryIndex === -1) {
            window.currentCommandBeforeHistory = input.value;
        }
        
        // Переходим к предыдущей команде
        if (window.commandHistory.length > 0) {
            if (window.commandHistoryIndex < window.commandHistory.length - 1) {
                window.commandHistoryIndex++;
            }
            input.value = window.commandHistory[window.commandHistory.length - 1 - window.commandHistoryIndex];
        }
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (window.commandHistoryIndex > 0) {
            window.commandHistoryIndex--;
            input.value = window.commandHistory[window.commandHistory.length - 1 - window.commandHistoryIndex];
        } else if (window.commandHistoryIndex === 0) {
            window.commandHistoryIndex = -1;
            input.value = window.currentCommandBeforeHistory;
        }
    }
};

/**
 * Переключение вкладок
 */
function switchTab(tabName, tabElement) {
    // Убираем активный класс со всех вкладок и контента
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Активируем выбранную вкладку
    tabElement.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Если переключились на карту, устанавливаем src для iframe если он еще не установлен
    if (tabName === 'map') {
        const iframe = document.getElementById('map-iframe');
        if (!iframe.src || iframe.src === window.location.href) {
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            // Если зашли через домен, используем проксирование Nginx (без портов)
            if (hostname === 'minecraft.ridramecraft.ru') {
                iframe.src = `${protocol}//${hostname}/map/`;
            } else {
                // Для доступа по IP продолжаем использовать прямой порт
                iframe.src = `${protocol}//${hostname}:25589`;
            }
        }
    }

    // Если переключились на терминал (логи сервера), загружаем логи
    if (tabName === 'terminal') {
        // Загружаем логи при переключении на вкладку
        if (typeof loadLogs === 'function') {
            loadLogs();
        }
        // Включаем автообновление автоматически, если чекбокс отмечен
        const checkbox = document.getElementById('auto-refresh-logs');
        if (checkbox && checkbox.checked && typeof toggleAutoRefresh === 'function') {
            toggleAutoRefresh();
        }
    }

    // Если переключились на банлист/whitelist, загружаем данные
    if (tabName === 'banlist') {
        if (typeof refreshBanlistAndWhitelist === 'function') {
            refreshBanlistAndWhitelist();
        }
        if (typeof toggleBanlistAutoRefresh === 'function') {
            // Включаем автообновление автоматически
            toggleBanlistAutoRefresh(true);
        }
    } else {
        if (typeof toggleBanlistAutoRefresh === 'function') {
            // Останавливаем автообновление при переключении на другую вкладку
            toggleBanlistAutoRefresh(false);
        }
    }
}

/**
 * Инициализация приложения
 */
document.addEventListener('DOMContentLoaded', function() {
    // Сначала скрываем все вкладки, которые зависят от доступа/доступности
    // Они будут показаны динамически при загрузке данных
    const adminTabs = ['commands-tab-btn', 'terminal-tab-btn', 'banlist-tab-btn'];
    adminTabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) tab.style.display = 'none';
    });
    const mapTab = document.getElementById('map-tab-btn');
    if (mapTab) mapTab.style.display = 'none';
    
    // Инициализация обработчиков команд
    if (typeof initCommandInputHandlers === 'function') {
        initCommandInputHandlers();
    }
    
    // Загрузка данных
    if (typeof loadCustomCommands === 'function') {
        loadCustomCommands().then(() => {
            if (typeof checkStatus === 'function') checkStatus();
            if (typeof loadPlayers === 'function') loadPlayers();
            if (typeof loadResources === 'function') loadResources();

            // Показываем вкладки в зависимости от уровня доступа
            const userRole = (window.userRole || 'guest');
            if (userRole === 'admin') {
                // Показываем все вкладки админа
                const commandsTabBtn = document.getElementById('commands-tab-btn');
                const terminalTabBtn = document.getElementById('terminal-tab-btn');
                const banlistTabBtn = document.getElementById('banlist-tab-btn');
                
                if (commandsTabBtn) commandsTabBtn.style.display = '';
                if (terminalTabBtn) terminalTabBtn.style.display = '';
                if (banlistTabBtn) banlistTabBtn.style.display = '';
                
                // Активируем первую вкладку (команды)
                if (commandsTabBtn) {
                    switchTab('commands', commandsTabBtn);
                }
            } else {
                // Для гостя вкладки админа остаются скрытыми (уже скрыты по умолчанию)
                // Вкладка карты будет показана в loadResources() если BlueMap доступен

                // Добавляем стили для скрытия кнопок действий над игроками и добавления команд
                const style = document.createElement('style');
                style.innerHTML = `
                    .player-actions-menu, .add-command-btn, .command-input-group { display: none !important; }
                    .player-card { cursor: default !important; }
                    .player-card:hover { transform: none !important; box-shadow: none !important; border-color: #333 !important; }
                    #banlist-tab button[onclick*="addTo"], #banlist-tab input[type="text"], 
                    #banlist-tab button[onclick*="removeFrom"] { display: none !important; }
                `;
                document.head.appendChild(style);
                
                // Меняем заголовок
                const mainHeader = document.querySelector('h2');
                if (mainHeader && mainHeader.textContent.includes('Консоль')) {
                    mainHeader.textContent = '🗺️ Обзор сервера';
                }
            }
        }).catch(() => {
            if (typeof renderQuickCommands === 'function') renderQuickCommands();
            if (typeof checkStatus === 'function') checkStatus();
            if (typeof loadPlayers === 'function') loadPlayers();
            if (typeof loadResources === 'function') loadResources();
        });
    } else {
        // Если модуль команд не загружен, все равно загружаем остальное
        if (typeof checkStatus === 'function') checkStatus();
        if (typeof loadPlayers === 'function') loadPlayers();
        if (typeof loadResources === 'function') loadResources();
        
        // Показываем вкладки в зависимости от уровня доступа
        const userRole = (window.userRole || 'guest');
        if (userRole === 'admin') {
            const commandsTabBtn = document.getElementById('commands-tab-btn');
            const terminalTabBtn = document.getElementById('terminal-tab-btn');
            const banlistTabBtn = document.getElementById('banlist-tab-btn');
            
            if (commandsTabBtn) commandsTabBtn.style.display = '';
            if (terminalTabBtn) terminalTabBtn.style.display = '';
            if (banlistTabBtn) banlistTabBtn.style.display = '';
            
            if (commandsTabBtn) {
                switchTab('commands', commandsTabBtn);
            }
        }
    }

    // Обновление каждые 5 секунд
    setInterval(() => {
        if (typeof checkStatus === 'function') checkStatus();
        if (typeof loadPlayers === 'function') loadPlayers();
        if (typeof loadResources === 'function') loadResources();
    }, 5000);
});
