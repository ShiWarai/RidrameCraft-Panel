const userRole = "{{ session.get('role', 'guest') }}";
        
        // Загрузка пользовательских команд
        let customCommands = [];

        function loadCustomCommands() {
            return fetch('/api/custom-commands')
                .then(response => {
                    if (response.status === 401) {
                        window.location.href = '/';
                        return Promise.reject('Unauthorized');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        customCommands = data.commands || [];
                    } else {
                        customCommands = [];
                    }
                    renderQuickCommands();
                    return Promise.resolve();
                })
                .catch(() => {
                    customCommands = [];
                    renderQuickCommands();
                    return Promise.resolve();
                });
        }

        function saveCustomCommands() {
            fetch('/api/custom-commands', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({commands: customCommands})
            });
        }

        function renderQuickCommands() {
            // Боковая панель больше не содержит команд - только ресурсы и игроки
            const mainContainer = document.getElementById('main-quick-commands');
            
            if (!mainContainer) {
                console.log('Main container not found');
                return; // Элемент еще не загружен
            }
            
            const defaultCommands = [
                {label: 'Ясная погода', command: 'weather clear'},
                {label: 'Дождь', command: 'weather rain'},
                {label: 'Гроза', command: 'weather thunder'}
            ];

            // Проверяем, что customCommands загружены
            if (typeof customCommands === 'undefined') {
                console.log('customCommands undefined, setting to []');
                customCommands = [];
            }
            
            console.log('renderQuickCommands called, customCommands.length:', customCommands.length);

            // Основная область - базовые команды + пользовательские команды
            mainContainer.innerHTML = '';
            
            // Сначала базовые команды
            defaultCommands.forEach((cmd) => {
                const div = document.createElement('div');
                div.className = 'quick-command';
                div.onclick = () => sendCommand(cmd.command);
                div.textContent = cmd.label;
                mainContainer.appendChild(div);
            });
            
            // Затем пользовательские команды с кнопкой удаления
            customCommands.forEach((cmd, index) => {
                const div = document.createElement('div');
                div.className = 'quick-command';
                div.onclick = () => sendCommand(cmd.command);
                div.textContent = cmd.label;
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '×';
                deleteBtn.title = 'Удалить';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteCommand(index);
                };
                div.appendChild(deleteBtn);
                mainContainer.appendChild(div);
            });
        }

        function openAddCommandModal() {
            const modal = document.getElementById('add-command-modal');
            modal.classList.add('active');
            setTimeout(() => {
                document.getElementById('modal-command-input').focus();
            }, 100);
        }

        function closeAddCommandModal() {
            const modal = document.getElementById('add-command-modal');
            modal.classList.remove('active');
            document.getElementById('modal-command-input').value = '';
            document.getElementById('modal-label-input').value = '';
        }

        function addCustomCommandFromModal() {
            const commandInput = document.getElementById('modal-command-input');
            const labelInput = document.getElementById('modal-label-input');
            const command = commandInput.value.trim();
            const label = labelInput.value.trim() || command;

            if (command) {
                customCommands.push({label, command});
                saveCustomCommands();
                renderQuickCommands();
                closeAddCommandModal();
            } else {
                alert('Пожалуйста, введите команду');
                commandInput.focus();
            }
        }

        // Закрытие модального окна при клике вне его
        document.addEventListener('click', function(event) {
            const modal = document.getElementById('add-command-modal');
            if (event.target === modal) {
                closeAddCommandModal();
            }
        });

        // Закрытие модального окна по Escape
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const modal = document.getElementById('add-command-modal');
                if (modal.classList.contains('active')) {
                    closeAddCommandModal();
                }
            }
        });

        // Функция для инициализации обработчиков
        function initCommandInputHandlers() {
            const commandInput = document.getElementById('modal-command-input');
            const labelInput = document.getElementById('modal-label-input');
            if (commandInput) {
                commandInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomCommandFromModal();
                    }
                });
            }
            
            // Добавляем обработчик для истории команд (стрелки вверх/вниз)
            const mainCommandInput = document.getElementById('command-input');
            if (mainCommandInput) {
                mainCommandInput.addEventListener('keydown', handleKeyPress);
            }
            if (labelInput) {
                labelInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomCommandFromModal();
                    }
                });
            }
        }
        
        // Отправка формы по Enter в поле команды
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCommandInputHandlers);
        } else {
            // DOM уже загружен
            initCommandInputHandlers();
        }

        function deleteCommand(index) {
            customCommands.splice(index, 1);
            saveCustomCommands();
            renderQuickCommands();
        }

        function loadPlayers() {
            fetch('/api/players')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('players-list');
                    const playersCountElement = document.getElementById('players-count');
                    const playersCount = data.success ? (data.players ? data.players.length : 0) : 0;
                    
                    // Обновляем счетчик игроков
                    playersCountElement.textContent = `(${playersCount})`;
                    
                    if (data.success && data.players.length > 0) {
                        container.innerHTML = data.players.map(player => {
                            const defaultAvatar = 'https://mc-heads.net/avatar/8667ba71-b85a-4004-af54-457fa973f346/40';
                            const avatarUrl = player.avatar || (player.uuid ? `https://mc-heads.net/avatar/${player.uuid}/40` : defaultAvatar);
                            // Экранируем имя игрока для использования в JavaScript
                            const playerNameEscaped = player.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            return `
                            <div class="player-card" onclick="event.stopPropagation(); togglePlayerMenu('${playerNameEscaped}', event)">
                                <img src="${avatarUrl}" 
                                     alt="${player.name}" 
                                     class="player-avatar"
                                     onerror="this.src='${defaultAvatar}'">
                                <div class="player-name">${player.name}</div>
                                <div class="player-actions-menu" id="menu-${playerNameEscaped}" onclick="event.stopPropagation()">
                                    <div class="actions-column">
                                        <div class="player-action-item kick" onclick="event.stopPropagation(); performPlayerAction('${playerNameEscaped}', 'kick')">
                                            <span>⚡</span> Кикнуть
                                        </div>
                                        <div class="player-action-item kill" onclick="event.stopPropagation(); performPlayerAction('${playerNameEscaped}', 'kill')">
                                            <span>💀</span> Убить
                                        </div>
                                        <div class="player-action-item ban" onclick="event.stopPropagation(); performPlayerAction('${playerNameEscaped}', 'ban')">
                                            <span>🚫</span> Забанить
                                        </div>
                                        <div class="player-action-item op" onclick="event.stopPropagation(); performPlayerAction('${playerNameEscaped}', 'op')">
                                            <span>👑</span> Дать OP
                                        </div>
                                        <div class="player-action-item deop" onclick="event.stopPropagation(); performPlayerAction('${playerNameEscaped}', 'deop')">
                                            <span>➖</span> Снять OP
                                        </div>
                                    </div>
                                    <div class="gamemodes-column">
                                        <div class="player-action-item" onclick="event.stopPropagation(); performPlayerAction('${playerNameEscaped}', 'survival')">
                                            <span>❤️</span> Выживание
                                        </div>
                                        <div class="player-action-item" onclick="event.stopPropagation(); performPlayerAction('${playerNameEscaped}', 'creative')">
                                            <span>🛠️</span> Креатив
                                        </div>
                                        <div class="player-action-item" onclick="event.stopPropagation(); performPlayerAction('${playerNameEscaped}', 'spectator')">
                                            <span>👁️</span> Наблюдатель
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                        }).join('');
                    } else {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-state-icon">👤</div>
                                <div>Нет игроков онлайн</div>
                            </div>
                        `;
                    }
                })
                .catch(() => {
                    document.getElementById('players-list').innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">⚠️</div>
                            <div>Ошибка загрузки</div>
                        </div>
                    `;
                    document.getElementById('players-count').textContent = '(?)';
                });
        }

        let activePlayerMenu = null;

        function togglePlayerMenu(playerName, event) {
            const menu = document.getElementById(`menu-${playerName}`);
            if (!menu) return;
            
            // Если меню уже открыто, просто закрываем его
            if (activePlayerMenu === menu) {
                menu.classList.remove('active');
                activePlayerMenu = null;
                return;
            }

            // Закрываем предыдущее меню если открыто
            if (activePlayerMenu) {
                activePlayerMenu.classList.remove('active');
            }
            
            // Позиционируем меню относительно карточки
            const card = event.currentTarget;
            const rect = card.getBoundingClientRect();
            
            menu.style.top = (rect.bottom + 5) + 'px';
            menu.style.left = (rect.left) + 'px';
            
            // Включаем меню
            menu.classList.add('active');
            activePlayerMenu = menu;
        }

        // Закрываем меню при скролле сайдбара
        document.addEventListener('DOMContentLoaded', () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.addEventListener('scroll', () => {
                    if (activePlayerMenu) {
                        activePlayerMenu.classList.remove('active');
                        activePlayerMenu = null;
                    }
                });
            }
        });

        // Закрываем меню при клике вне его
        document.addEventListener('click', function(event) {
            if (activePlayerMenu && !activePlayerMenu.contains(event.target) && !event.target.closest('.player-card')) {
                activePlayerMenu.classList.remove('active');
                activePlayerMenu = null;
            }
        });

        function performPlayerAction(playerName, action) {
            const actionNames = {
                'kick': 'кикнут',
                'kill': 'убит',
                'ban': 'забанен',
                'op': 'повышен до оператора',
                'deop': 'лишен прав оператора',
                'survival': 'переведен в выживание',
                'creative': 'переведен в креатив',
                'spectator': 'переведен в режим наблюдателя'
            };
            
            const actionName = actionNames[action] || action;
            
            if (action === 'ban' || action === 'kick') {
                const reason = prompt(`Введите причину для ${action === 'ban' ? 'бана' : 'кика'} игрока ${playerName}:`, 
                    action === 'ban' ? 'Забанен администратором' : 'Выгнан администратором');
                if (reason === null) return; // Пользователь отменил
                
                fetch('/api/player-action', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({player: playerName, action: action, reason: reason})
                })
                .then(response => {
                    if (response.status === 401) {
                        window.location.href = '/';
                        return Promise.reject('Unauthorized');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        addConsoleLine(`Игрок ${playerName} ${actionName}. Причина: ${reason}`, 'success');
                        setTimeout(loadPlayers, 500);
                    } else {
                        addConsoleLine(`Ошибка при выполнении действия над игроком ${playerName}: ${data.error}`, 'error');
                    }
                    // Закрываем меню
                    if (activePlayerMenu) {
                        activePlayerMenu.classList.remove('active');
                        activePlayerMenu = null;
                    }
                })
                .catch(error => {
                    addConsoleLine(`Ошибка соединения: ${error.message}`, 'error');
                    if (activePlayerMenu) {
                        activePlayerMenu.classList.remove('active');
                        activePlayerMenu = null;
                    }
                });
            } else {
                // Для остальных действий (kill, op, deop, gamemodes) подтверждение по желанию
                // Для kill оставим подтверждение
                if (action === 'kill' && !confirm(`Вы уверены, что хотите убить игрока ${playerName}?`)) {
                    return;
                }
                
                fetch('/api/player-action', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({player: playerName, action: action})
                })
                .then(response => {
                    if (response.status === 401) {
                        window.location.href = '/';
                        return Promise.reject('Unauthorized');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        addConsoleLine(`Игрок ${playerName} ${actionName}`, 'success');
                        setTimeout(loadPlayers, 500);
                    } else {
                        addConsoleLine(`Ошибка при выполнении действия над игроком ${playerName}: ${data.error}`, 'error');
                    }
                    // Закрываем меню
                    if (activePlayerMenu) {
                        activePlayerMenu.classList.remove('active');
                        activePlayerMenu = null;
                    }
                })
                .catch(error => {
                    addConsoleLine(`Ошибка соединения: ${error.message}`, 'error');
                    if (activePlayerMenu) {
                        activePlayerMenu.classList.remove('active');
                        activePlayerMenu = null;
                    }
                });
            }
        }

        function loadResources() {
            fetch('/api/resources')
                .then(response => response.json())
                .then(data => {
                    try {
                    if (data.success) {
                        // CPU
                        const cpuValue = document.getElementById('cpu-value');
                        const cpuProgress = document.getElementById('cpu-progress');
                        const cpuPercent = (data.cpu && data.cpu.percent !== undefined && data.cpu.percent !== null) ? 
                            Math.min(100, Math.max(0, parseFloat(data.cpu.percent))) : 0;
                        if (cpuValue && cpuProgress && !isNaN(cpuPercent)) {
                            cpuValue.textContent = `${cpuPercent.toFixed(1)}%`;
                            cpuProgress.style.width = `${cpuPercent}%`;
                            cpuProgress.className = 'progress-fill' + 
                            (cpuPercent > 80 ? ' danger' : cpuPercent > 60 ? ' warning' : '');
                        } else if (cpuValue) {
                            cpuValue.textContent = '-';
                        }

                        // RAM - используем heap память если доступна, иначе общую память контейнера
                        let ramUsed = (data.ram && data.ram.heap && data.ram.heap.used) || 
                                     (data.ram && data.ram.used) || 0;
                        let ramTotal = (data.ram && data.ram.heap && data.ram.heap.max) || 
                                      (data.ram && data.ram.total) || 0;
                        let ramPercent = 0;
                        
                        if (ramTotal > 0) {
                            ramPercent = (ramUsed / ramTotal) * 100;
                        } else {
                            ramPercent = (data.ram && data.ram.percent) || 0;
                        }
                        
                        const ramValue = document.getElementById('ram-value');
                        const ramProgress = document.getElementById('ram-progress');
                        
                        if (ramValue && ramProgress && !isNaN(ramUsed) && !isNaN(ramTotal) && !isNaN(ramPercent)) {
                            const ramDisplayText = `${ramUsed.toFixed(2)} / ${ramTotal.toFixed(2)} GB (${ramPercent.toFixed(1)}%)`;
                            ramValue.textContent = ramDisplayText;
                            ramProgress.style.width = `${Math.min(ramPercent, 100)}%`;
                            ramProgress.className = 'progress-fill' + 
                                (ramPercent > 90 ? ' danger' : ramPercent > 75 ? ' warning' : '');
                        }
                        
                        // Отображаем данные Spark если доступны
                        const sparkSection = document.getElementById('spark-data-section');
                        if (data.spark_available && sparkSection) {
                            sparkSection.style.display = 'block';
                            
                            // TPS
                            const tpsElement = document.getElementById('tps-value');
                            const tpsDetailsElement = document.getElementById('tps-details');
                            if (tpsElement) {
                                if (data.tps && (data.tps.current !== undefined || data.tps.tenSeconds !== undefined)) {
                                    const currentTps = data.tps.current || data.tps.tenSeconds || 0;
                                    tpsElement.textContent = currentTps.toFixed(2);
                                    const tpsItem = tpsElement.parentElement;
                                    tpsItem.className = 'status-item' + 
                                        (currentTps < 15 ? ' danger' : currentTps < 18 ? ' warning' : '');
                                    
                                    // Детали TPS
                                    if (tpsDetailsElement && data.tps.oneMinute !== undefined) {
                                        tpsDetailsElement.textContent = `1m: ${data.tps.oneMinute.toFixed(2)} | 5m: ${(data.tps.fiveMinutes || 0).toFixed(2)}`;
                                    }
                                } else {
                                    tpsElement.textContent = '-';
                                    if (tpsDetailsElement) tpsDetailsElement.textContent = '-';
                                }
                            }
                            
                            // MSPT
                            const msptElement = document.getElementById('mspt-value');
                            const msptDetailsElement = document.getElementById('mspt-details');
                            if (msptElement) {
                                if (data.mspt !== undefined && data.mspt !== null) {
                                    let mspt = 0;
                                    let msptDetails = '';
                                    
                                    if (typeof data.mspt === 'object' && data.mspt.current !== undefined) {
                                        mspt = data.mspt.current;
                                        if (data.mspt.oneMinute && typeof data.mspt.oneMinute === 'object') {
                                            const median = data.mspt.oneMinute.median || 0;
                                            const max = data.mspt.oneMinute.max || 0;
                                            msptDetails = `med: ${median.toFixed(2)}ms | max: ${max.toFixed(2)}ms`;
                                        }
                                    } else if (typeof data.mspt === 'object' && data.mspt.oneMinute !== undefined) {
                                        // Новая структура с oneMinute и tenSeconds
                                        const oneMinute = data.mspt.oneMinute || {};
                                        mspt = oneMinute.median || oneMinute.current || 0;
                                        if (oneMinute.median !== undefined && oneMinute.max !== undefined) {
                                            msptDetails = `med: ${oneMinute.median.toFixed(2)}ms | max: ${oneMinute.max.toFixed(2)}ms`;
                                        }
                                    } else if (typeof data.mspt === 'object' && data.mspt.average !== undefined) {
                                        mspt = data.mspt.average;
                                    } else if (typeof data.mspt === 'number') {
                                        mspt = data.mspt;
                                    }
                                    
                                    if (mspt > 0) {
                                        msptElement.textContent = mspt.toFixed(2) + ' ms';
                                        const msptItem = msptElement.parentElement;
                                        msptItem.className = 'status-item' + 
                                            (mspt > 50 ? ' danger' : mspt > 40 ? ' warning' : '');
                                        
                                        if (msptDetailsElement) {
                                            msptDetailsElement.textContent = msptDetails || '-';
                                        }
                                    } else {
                                        msptElement.textContent = '-';
                                        if (msptDetailsElement) msptDetailsElement.textContent = '-';
                                    }
                                } else {
                                    msptElement.textContent = '-';
                                    if (msptDetailsElement) msptDetailsElement.textContent = '-';
                                }
                            }
                            
                            // Убираем отдельные секции для Spark CPU и Memory - они уже используются в основных CPU и RAM
                        } else if (sparkSection) {
                            sparkSection.style.display = 'none';
                        }
                    } else {
                        const cpuValue = document.getElementById('cpu-value');
                        const ramValue = document.getElementById('ram-value');
                        if (cpuValue) cpuValue.textContent = `Ошибка: ${data.error || 'Неизвестная ошибка'}`;
                        if (ramValue) ramValue.textContent = `Ошибка: ${data.error || 'Неизвестная ошибка'}`;
                    }
                    } catch (e) {
                        console.error('Error processing resources data:', e, data);
                        const cpuValue = document.getElementById('cpu-value');
                        const ramValue = document.getElementById('ram-value');
                        if (cpuValue) cpuValue.textContent = `Ошибка: ${e.message}`;
                        if (ramValue) ramValue.textContent = `Ошибка: ${e.message}`;
                    }
                })
                .catch(error => {
                    console.error('Error fetching resources:', error);
                    const cpuValue = document.getElementById('cpu-value');
                    const ramValue = document.getElementById('ram-value');
                    if (cpuValue) cpuValue.textContent = `Ошибка: ${error.message}`;
                    if (ramValue) ramValue.textContent = `Ошибка: ${error.message}`;
                });
        }

        function checkStatus() {
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    const statusEl = document.getElementById('server-status');
                    const statusText = document.getElementById('status-text');
                    if (data.online) {
                        statusEl.className = 'status-item';
                        statusText.textContent = 'Онлайн';
                    } else {
                        statusEl.className = 'status-item offline';
                        statusText.textContent = 'Оффлайн';
                    }
                });
        }

        function logout() {
            fetch('/api/logout', {method: 'POST'})
                .then(() => {
                    window.location.href = '/';
                });
        }

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

        function sendCommand(command) {
            const input = document.getElementById('command-input');
            input.value = command;
            sendCommandFromInput();
        }

        function sendCommandFromInput() {
            const input = document.getElementById('command-input');
            const command = input.value.trim();
            
            if (!command) return;

            // Добавляем команду в историю (если она не совпадает с последней)
            if (window.commandHistory.length === 0 || window.commandHistory[window.commandHistory.length - 1] !== command) {
                window.commandHistory.push(command);
                // Ограничиваем историю 100 командами
                if (window.commandHistory.length > 100) {
                    window.commandHistory.shift();
                }
            }
            // Сбрасываем индекс истории
            window.commandHistoryIndex = -1;
            window.currentCommandBeforeHistory = '';

            addConsoleLine(`> ${command}`, 'info');
            input.value = '';

            fetch('/api/command', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({command})
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Разбиваем длинный ответ на строки для лучшей читаемости
                    const response = data.response || 'Команда выполнена успешно';
                    const lines = response.split('\n');
                    if (lines.length > 1) {
                        // Если ответ многострочный, выводим каждую строку отдельно
                        lines.forEach(line => {
                            if (line.trim()) {
                                addConsoleLine(line.trim(), 'success');
                            }
                        });
                    } else {
                        addConsoleLine(response, 'success');
                    }
                    if (command === 'list') {
                        setTimeout(loadPlayers, 500);
                    }
                } else {
                    addConsoleLine(`Ошибка: ${data.error}`, 'error');
                }
            })
            .catch(error => {
                addConsoleLine(`Ошибка соединения: ${error.message}`, 'error');
            });
        }

        // История команд (как в Linux терминале)
        window.commandHistory = window.commandHistory || [];
        window.commandHistoryIndex = window.commandHistoryIndex !== undefined ? window.commandHistoryIndex : -1;
        window.currentCommandBeforeHistory = window.currentCommandBeforeHistory || '';

        window.handleKeyPress = function(event) {
            const input = document.getElementById('command-input');
            
            if (event.key === 'Enter') {
                sendCommandFromInput();
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
        }

        // Переключение вкладок
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

            // Если переключились на консоль (терминал), устанавливаем src
            if (tabName === 'terminal') {
                const iframe = document.getElementById('terminal-iframe');
                if (!iframe.src || iframe.src === window.location.href) {
                    const protocol = window.location.protocol;
                    const hostname = window.location.hostname;
                    // Если зашли через домен, используем проксирование Nginx (без портов)
                    if (hostname === 'minecraft.ridramecraft.ru') {
                        iframe.src = `${protocol}//${hostname}/console-live/`;
                    } else {
                        // Для доступа по IP продолжаем использовать прямой порт
                        iframe.src = `${protocol}//${hostname}:25590`;
                    }
                }
            }

            // Если переключились на банлист/whitelist, загружаем данные
            if (tabName === 'banlist') {
                refreshBanlistAndWhitelist();
                // Включаем автообновление автоматически
                toggleBanlistAutoRefresh(true);
            } else {
                // Останавливаем автообновление при переключении на другую вкладку
                toggleBanlistAutoRefresh(false);
            }
        }

        // Автообновление банлиста и whitelist
        let banlistAutoRefreshInterval = null;
        let banlistUpdateInProgress = false; // Флаг для предотвращения конфликтов обновлений

        function refreshBanlistAndWhitelist() {
            // Пропускаем обновление если уже идет обновление после изменения
            if (banlistUpdateInProgress) {
                return;
            }
            // При автообновлении не показываем загрузку, список остается видимым
            loadBanlist(false);
            loadWhitelist(false);
        }

        function toggleBanlistAutoRefresh(enable) {
            // Останавливаем предыдущий интервал если есть
            if (banlistAutoRefreshInterval) {
                clearInterval(banlistAutoRefreshInterval);
                banlistAutoRefreshInterval = null;
            }
            
            if (enable) {
                banlistAutoRefreshInterval = setInterval(refreshBanlistAndWhitelist, 5000); // Обновляем каждые 5 секунд
            }
        }

        // Функция для обновления списков после изменения (с временным отключением автообновления)
        function updateBanlistAfterChange() {
            banlistUpdateInProgress = true;
            // Обновляем списки без показа загрузки
            loadBanlist(false);
            loadWhitelist(false);
            // Через небольшую задержку возобновляем автообновление
            setTimeout(() => {
                banlistUpdateInProgress = false;
            }, 1000);
        }

        // Функция для получения UUID игрока через Mojang API
        async function getPlayerUUID(username) {
            try {
                const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
                if (response.ok) {
                    const data = await response.json();
                    let uuid = data.id;
                    // Форматируем UUID с дефисами
                    if (uuid && uuid.length === 32 && uuid.indexOf('-') === -1) {
                        uuid = `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20)}`;
                    }
                    return uuid;
                }
            } catch (e) {
                console.error(`Error getting UUID for ${username}:`, e);
            }
            return null;
        }

        // Функция для получения URL аватарки
        function getPlayerAvatarUrl(username, uuid) {
            if (uuid) {
                return `https://mc-heads.net/avatar/${uuid}/40`;
            }
            return 'https://mc-heads.net/avatar/8667ba71-b85a-4004-af54-457fa973f346/40'; // Дефолтный аватар
        }

        // Функции для работы с банлистом
        async function loadBanlist(showLoading = true) {
            const container = document.getElementById('banlist-container');
            
            // Сохраняем старое содержимое
            const oldContent = container.innerHTML;
            const isEmpty = oldContent.includes('empty-state') && (oldContent.includes('Загрузка') || oldContent.trim() === '');
            
            // Показываем индикатор загрузки только если контейнер действительно пуст (первая загрузка)
            // При автообновлении (showLoading = false) никогда не показываем загрузку
            if (showLoading && isEmpty) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Загрузка...</div></div>';
            }
            
            fetch('/api/banlist')
                .then(response => {
                    if (response.status === 401) {
                        window.location.href = '/';
                        return Promise.reject('Unauthorized');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.players && data.players.length > 0) {
                        container.innerHTML = data.players.map(player => {
                            const defaultAvatar = 'https://mc-heads.net/avatar/8667ba71-b85a-4004-af54-457fa973f346/40';
                            const avatarUrl = player.avatar || (player.uuid ? `https://mc-heads.net/avatar/${player.uuid}/40` : defaultAvatar);
                            const playerEscaped = player.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 4px; margin-bottom: 8px;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <img src="${avatarUrl}" 
                                             alt="${player.name}" 
                                             style="width: 32px; height: 32px; border-radius: 2px; border: 1px solid #444; image-rendering: pixelated;"
                                             onerror="this.src='${defaultAvatar}'">
                                        <span style="color: #e0e0e0; font-weight: 500;">${player.name}</span>
                                    </div>
                                    ${userRole === 'admin' ? `<button onclick="removeFromBanlist('${playerEscaped}')" style="padding: 6px 12px; background: #ff5555; color: white; border: 2px solid #000; border-radius: 0; cursor: pointer; font-size: 0.85em; font-weight: 600; box-shadow: inset -2px -2px 0 rgba(0,0,0,0.4), inset 2px 2px 0 rgba(255,255,255,0.15);">Разбанить</button>` : ''}
                                </div>
                            `;
                        }).join('');
                    } else {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-state-icon">✅</div>
                                <div>Нет забаненных игроков</div>
                            </div>
                        `;
                    }
                })
                .catch(error => {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">⚠️</div>
                            <div>Ошибка загрузки: ${error.message || 'Неизвестная ошибка'}</div>
                        </div>
                    `;
                });
        }

        function addToBanlist() {
            if (userRole !== 'admin') {
                alert('Недостаточно прав для выполнения этого действия');
                return;
            }
            
            const playerInput = document.getElementById('ban-player-input');
            const reasonInput = document.getElementById('ban-reason-input');
            const player = playerInput.value.trim();
            const reason = reasonInput.value.trim() || 'Забанен администратором';
            
            if (!player) {
                alert('Введите имя игрока');
                playerInput.focus();
                return;
            }
            
            fetch('/api/banlist', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'add', player: player, reason: reason})
            })
            .then(response => {
                if (response.status === 401) {
                    window.location.href = '/';
                    return Promise.reject('Unauthorized');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    playerInput.value = '';
                    reasonInput.value = '';
                    updateBanlistAfterChange();
                    addConsoleLine(`Игрок ${player} добавлен в банлист. Причина: ${reason}`, 'success');
                } else {
                    alert(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
                }
            })
            .catch(error => {
                alert(`Ошибка соединения: ${error.message}`);
            });
        }

        function removeFromBanlist(player) {
            if (userRole !== 'admin') {
                alert('Недостаточно прав для выполнения этого действия');
                return;
            }
            
            if (!confirm(`Вы уверены, что хотите разбанить игрока ${player}?`)) {
                return;
            }
            
            fetch('/api/banlist', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'remove', player: player})
            })
            .then(response => {
                if (response.status === 401) {
                    window.location.href = '/';
                    return Promise.reject('Unauthorized');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    updateBanlistAfterChange();
                    addConsoleLine(`Игрок ${player} разбанен`, 'success');
                } else {
                    alert(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
                }
            })
            .catch(error => {
                alert(`Ошибка соединения: ${error.message}`);
            });
        }

        // Функции для работы с whitelist
        async function loadWhitelist(showLoading = true) {
            const container = document.getElementById('whitelist-container');
            
            // Сохраняем старое содержимое
            const oldContent = container.innerHTML;
            const isEmpty = oldContent.includes('empty-state') && (oldContent.includes('Загрузка') || oldContent.trim() === '');
            
            // Показываем индикатор загрузки только если контейнер действительно пуст (первая загрузка)
            // При автообновлении (showLoading = false) никогда не показываем загрузку
            if (showLoading && isEmpty) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Загрузка...</div></div>';
            }
            
            fetch('/api/whitelist')
                .then(response => {
                    if (response.status === 401) {
                        window.location.href = '/';
                        return Promise.reject('Unauthorized');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.players && data.players.length > 0) {
                        container.innerHTML = data.players.map(player => {
                            const defaultAvatar = 'https://mc-heads.net/avatar/8667ba71-b85a-4004-af54-457fa973f346/40';
                            const avatarUrl = player.avatar || (player.uuid ? `https://mc-heads.net/avatar/${player.uuid}/40` : defaultAvatar);
                            const playerEscaped = player.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 4px; margin-bottom: 8px;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <img src="${avatarUrl}" 
                                             alt="${player.name}" 
                                             style="width: 32px; height: 32px; border-radius: 2px; border: 1px solid #444; image-rendering: pixelated;"
                                             onerror="this.src='${defaultAvatar}'">
                                        <span style="color: #e0e0e0; font-weight: 500;">${player.name}</span>
                                    </div>
                                    ${userRole === 'admin' ? `<button onclick="removeFromWhitelist('${playerEscaped}')" style="padding: 6px 12px; background: #ff5555; color: white; border: 2px solid #000; border-radius: 0; cursor: pointer; font-size: 0.85em; font-weight: 600; box-shadow: inset -2px -2px 0 rgba(0,0,0,0.4), inset 2px 2px 0 rgba(255,255,255,0.15);">Удалить</button>` : ''}
                                </div>
                            `;
                        }).join('');
                    } else {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-state-icon">📝</div>
                                <div>Белый список пуст</div>
                            </div>
                        `;
                    }
                })
                .catch(error => {
                    // Восстанавливаем старое содержимое при ошибке, если оно было
                    if (!isEmpty && oldContent) {
                        container.innerHTML = oldContent;
                    } else {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-state-icon">⚠️</div>
                                <div>Ошибка загрузки: ${error.message || 'Неизвестная ошибка'}</div>
                            </div>
                        `;
                    }
                });
        }

        function addToWhitelist() {
            if (userRole !== 'admin') {
                alert('Недостаточно прав для выполнения этого действия');
                return;
            }
            
            const playerInput = document.getElementById('whitelist-player-input');
            const player = playerInput.value.trim();
            
            if (!player) {
                alert('Введите имя игрока');
                playerInput.focus();
                return;
            }
            
            fetch('/api/whitelist', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'add', player: player})
            })
            .then(response => {
                if (response.status === 401) {
                    window.location.href = '/';
                    return Promise.reject('Unauthorized');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    playerInput.value = '';
                    updateBanlistAfterChange();
                    addConsoleLine(`Игрок ${player} добавлен в белый список`, 'success');
                } else {
                    alert(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
                }
            })
            .catch(error => {
                alert(`Ошибка соединения: ${error.message}`);
            });
        }

        function removeFromWhitelist(player) {
            if (userRole !== 'admin') {
                alert('Недостаточно прав для выполнения этого действия');
                return;
            }
            
            if (!confirm(`Вы уверены, что хотите удалить игрока ${player} из белого списка?`)) {
                return;
            }
            
            fetch('/api/whitelist', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'remove', player: player})
            })
            .then(response => {
                if (response.status === 401) {
                    window.location.href = '/';
                    return Promise.reject('Unauthorized');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    updateBanlistAfterChange();
                    addConsoleLine(`Игрок ${player} удален из белого списка`, 'success');
                } else {
                    alert(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
                }
            })
            .catch(error => {
                alert(`Ошибка соединения: ${error.message}`);
            });
        }

        // Обработчики Enter для полей ввода и чекбокса автообновления
        document.addEventListener('DOMContentLoaded', () => {
            const banPlayerInput = document.getElementById('ban-player-input');
            const banReasonInput = document.getElementById('ban-reason-input');
            const whitelistPlayerInput = document.getElementById('whitelist-player-input');
            
            if (banPlayerInput) {
                banPlayerInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addToBanlist();
                    }
                });
            }
            
            if (banReasonInput) {
                banReasonInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addToBanlist();
                    }
                });
            }
            
            if (whitelistPlayerInput) {
                whitelistPlayerInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addToWhitelist();
                    }
                });
            }
        });

        // Загрузка логов сервера
        let autoRefreshInterval = null;
        
        function loadLogs() {
            const tail = document.getElementById('logs-tail').value;
            const logsConsole = document.getElementById('logs-console');
            
            fetch(`/api/logs?tail=${tail}`)
                .then(response => {
                    if (response.status === 401) {
                        window.location.href = '/';
                        return Promise.reject('Unauthorized');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        logsConsole.innerHTML = '';
                        if (data.logs && data.logs.length > 0) {
                            data.logs.forEach(logLine => {
                                // Фильтруем шумные сообщения RCON, которые не несут полезной информации
                                const logText = logLine.toLowerCase();
                                if (logText.includes('rcon client') && 
                                    (logText.includes('started') || logText.includes('shutting down'))) {
                                    return; // Пропускаем эти строки
                                }
                                
                                const line = document.createElement('div');
                                line.className = 'console-line';
                                
                                // Определяем тип строки по содержимому с более точным парсингом
                                let lineType = 'info';
                                
                                // Паттерны для определения типа лога
                                // Критические ошибки и фатальные ошибки
                                if (logText.match(/\[.*\/fatal\]|\[.*\/error\]|fatal|exception|crash|failed|cannot|unable|denied|access denied/i)) {
                                    lineType = 'error';
                                }
                                // Предупреждения
                                else if (logText.match(/\[.*\/warn\]|\[.*\/warning\]|warn|warning|deprecated/i)) {
                                    lineType = 'warn';
                                }
                                // Успешные операции
                                else if (logText.match(/\[.*\/info\].*done|\[.*\/info\].*success|\[.*\/info\].*completed|\[.*\/info\].*loaded|\[.*\/info\].*started|\[.*\/info\].*ready/i)) {
                                    lineType = 'success';
                                }
                                // Стандартные информационные сообщения Minecraft
                                else if (logText.match(/\[.*\/info\]/)) {
                                    lineType = 'info';
                                }
                                // Сообщения о подключении/отключении игроков
                                else if (logText.match(/joined|left|disconnected|connected|logged in/i)) {
                                    lineType = 'success';
                                }
                                // Сообщения о загрузке модов, плагинов
                                else if (logText.match(/loading|loaded|found mod|mod file/i)) {
                                    lineType = 'info';
                                }
                                
                                line.className = `console-line ${lineType}`;
                                
                                // Форматируем строку с подсветкой ключевых слов
                                // Сначала очищаем от возможных HTML тегов в исходных логах Docker
                                let cleanText = logLine.replace(/<[^>]*>/g, ''); // Удаляем любые HTML теги из исходного текста
                                let formattedText = cleanText.replace(/\n/g, '<br>');
                                
                                // Применяем подсветку в правильном порядке (от более специфичных к общим)
                                // Используем простой подход: применяем только к тексту, который еще не обернут в теги
                                
                                // 1. Подсветка временных меток ISO (в начале строки, до первого пробела или скобки)
                                formattedText = formattedText.replace(/^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/, '<span style="color: #888;">$1</span>');
                                
                                // 2. Подсветка уровней логирования Minecraft (более специфичные паттерны первыми)
                                // Используем более точные паттерны, чтобы избежать конфликтов
                                formattedText = formattedText.replace(/\[([^\]]*\/FATAL[^\]]*)\]/gi, '<span style="color: #f44336; font-weight: bold;">[$1]</span>');
                                formattedText = formattedText.replace(/\[([^\]]*\/ERROR[^\]]*)\]/gi, '<span style="color: #f48771; font-weight: bold;">[$1]</span>');
                                formattedText = formattedText.replace(/\[([^\]]*\/WARN[^\]]*)\]/gi, '<span style="color: #ff9800; font-weight: bold;">[$1]</span>');
                                formattedText = formattedText.replace(/\[([^\]]*\/DEBUG[^\]]*)\]/gi, '<span style="color: #888;">[$1]</span>');
                                formattedText = formattedText.replace(/\[([^\]]*\/INFO[^\]]*)\]/gi, '<span style="color: #569cd6;">[$1]</span>');
                                
                                // 3. Подсветка временных меток в формате [HH:MM:SS] (только если еще не подсвечены)
                                formattedText = formattedText.replace(/(\[\d{2}:\d{2}:\d{2}\])/g, function(match, p1, offset, string) {
                                    // Проверяем, не находимся ли мы внутри span тега
                                    const before = string.substring(Math.max(0, offset - 100), offset);
                                    if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                        return '<span style="color: #888;">' + p1 + '</span>';
                                    }
                                    return match;
                                });
                                
                                // 4. Подсветка потоков Minecraft (только если еще не подсвечены)
                                formattedText = formattedText.replace(/\[(Server thread|main|Worker|Netty|RCON|Watchdog)\]/gi, function(match, p1, offset, string) {
                                    if (typeof string !== 'string') return match;
                                    const before = string.substring(Math.max(0, offset - 100), offset);
                                    if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                        return '<span style="color: #9cdcfe;">[' + p1 + ']</span>';
                                    }
                                    return match;
                                });
                                
                                // 5. Подсветка ошибок и исключений
                                formattedText = formattedText.replace(/\b(Exception|Error|Failed|Cannot|Unable|AccessDenied|NullPointerException|ClassNotFoundException|NoClassDefFoundError)\b/gi, 
                                    function(match, p1, offset, string) {
                                        if (typeof string !== 'string') return match;
                                        const before = string.substring(Math.max(0, offset - 100), offset);
                                        if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                            return '<span style="color: #f48771; font-weight: bold;">' + p1 + '</span>';
                                        }
                                        return match;
                                    });
                                
                                // 6. Подсветка имен игроков
                                formattedText = formattedText.replace(/\b(joined|left|disconnected|connected|logged in|logged out)\s+([A-Za-z0-9_]+)\b/gi, 
                                    function(match, p1, p2, offset, string) {
                                        if (typeof string !== 'string') return match;
                                        const before = string.substring(Math.max(0, offset - 100), offset);
                                        if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                            return '<span style="color: #4ec9b0;">' + p1 + '</span> <span style="color: #ce9178; font-weight: bold;">' + p2 + '</span>';
                                        }
                                        return match;
                                    });
                                
                                // 7. Подсветка путей к файлам
                                formattedText = formattedText.replace(/(\/[^\s<>"']+\.(jar|class|java|properties|json|toml|txt|log))/gi, 
                                    function(match, p1, offset, string) {
                                        if (typeof string !== 'string') return match;
                                        const before = string.substring(Math.max(0, offset - 100), offset);
                                        if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                            return '<span style="color: #ce9178;">' + p1 + '</span>';
                                        }
                                        return match;
                                    });
                                
                                // 8. Подсветка версий
                                formattedText = formattedText.replace(/\b(\d+\.\d+\.\d+(?:\.\d+)?)\b/g, function(match, p1, offset, string) {
                                    if (typeof string !== 'string') return match;
                                    const before = string.substring(Math.max(0, offset - 100), offset);
                                    if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                        return '<span style="color: #b5cea8;">' + p1 + '</span>';
                                    }
                                    return match;
                                });
                                
                                // 9. Подсветка UUID
                                formattedText = formattedText.replace(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi, 
                                    function(match, p1, offset, string) {
                                        if (typeof string !== 'string') return match;
                                        const before = string.substring(Math.max(0, offset - 100), offset);
                                        if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                            return '<span style="color: #888; font-family: monospace;">' + p1 + '</span>';
                                        }
                                        return match;
                                    });
                                
                                // 10. Подсветка IP адресов
                                formattedText = formattedText.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?)\b/g, 
                                    function(match, p1, offset, string) {
                                        if (typeof string !== 'string') return match;
                                        const before = string.substring(Math.max(0, offset - 100), offset);
                                        if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                            return '<span style="color: #9cdcfe;">' + p1 + '</span>';
                                        }
                                        return match;
                                    });
                                
                                // 11. Подсветка команд Minecraft
                                formattedText = formattedText.replace(/(\/[a-z]+(?:\s+[^\s<>]+)*)/gi, function(match, p1, offset, string) {
                                    if (typeof string !== 'string') return match;
                                    const before = string.substring(Math.max(0, offset - 100), offset);
                                    if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                        return '<span style="color: #dcdcaa;">' + p1 + '</span>';
                                    }
                                    return match;
                                });
                                
                                // 12. Подсветка модов
                                formattedText = formattedText.replace(/\b(Found mod|Loading mod|mod file|Mod:)\s+([A-Za-z0-9_-]+)\b/gi, 
                                    function(match, p1, p2, offset, string) {
                                        if (typeof string !== 'string') return match;
                                        const before = string.substring(Math.max(0, offset - 100), offset);
                                        if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                            return '<span style="color: #4ec9b0;">' + p1 + '</span> <span style="color: #ce9178; font-weight: bold;">' + p2 + '</span>';
                                        }
                                        return match;
                                    });
                                
                                line.innerHTML = formattedText;
                                logsConsole.appendChild(line);
                            });
                        } else {
                            const emptyLine = document.createElement('div');
                            emptyLine.className = 'console-line info';
                            emptyLine.textContent = 'Логи пусты';
                            logsConsole.appendChild(emptyLine);
                        }
                        // Прокрутка вниз
                        setTimeout(() => {
                            logsConsole.scrollTop = logsConsole.scrollHeight + 1000;
                        }, 50);
                        
                        // Включаем автообновление если чекбокс отмечен и автообновление еще не запущено
                        const checkbox = document.getElementById('auto-refresh-logs');
                        if (checkbox && checkbox.checked && !autoRefreshInterval) {
                            toggleAutoRefresh();
                        }
                    } else {
                        logsConsole.innerHTML = `<div class="console-line error">Ошибка загрузки логов: ${data.error || 'Неизвестная ошибка'}</div>`;
                    }
                })
                .catch(error => {
                    logsConsole.innerHTML = `<div class="console-line error">Ошибка соединения: ${error.message}</div>`;
                });
        }

        // Автообновление логов
        function toggleAutoRefresh() {
            const checkbox = document.getElementById('auto-refresh-logs');
            if (checkbox && checkbox.checked) {
                // Останавливаем предыдущий интервал если есть
                if (autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                }
                autoRefreshInterval = setInterval(loadLogs, 5000); // Обновляем каждые 5 секунд
            } else {
                if (autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                    autoRefreshInterval = null;
                }
            }
        }

        // Инициализация - сначала загружаем команды, потом остальное
        // Убеждаемся, что customCommands инициализирован ДО вызова renderQuickCommands
        customCommands = [];
        loadCustomCommands().then(() => {
            checkStatus();
            loadPlayers();
            loadResources();

            // Ограничения для гостевого режима
            if (userRole === 'guest') {
                // Скрываем вкладки админа
                const commandsTabBtn = document.querySelector('button[onclick*="commands"]');
                const terminalTabBtn = document.querySelector('button[onclick*="terminal"]');
                const banlistTabBtn = document.querySelector('button[onclick*="banlist"]');
                
                if (commandsTabBtn) commandsTabBtn.style.display = 'none';
                if (terminalTabBtn) terminalTabBtn.style.display = 'none';
                if (banlistTabBtn) banlistTabBtn.style.display = 'none';

                // Переключаем на карту, если мы на вкладке команд по умолчанию
                const mapTabBtn = document.querySelector('button[onclick*="map"]');
                if (mapTabBtn) {
                    switchTab('map', mapTabBtn);
                }

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
            customCommands = [];
            renderQuickCommands();
            checkStatus();
            loadPlayers();
            loadResources();
        });

        // Обновление каждые 5 секунд
        setInterval(() => {
            checkStatus();
            loadPlayers();
            loadResources();
        }, 5000);