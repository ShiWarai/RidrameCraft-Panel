/**
 * Модуль для работы с игроками
 */

let activePlayerMenu = null;

function loadPlayers() {
    fetch('/api/players')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('players-list');
            const playersCountElement = document.getElementById('players-count');
            const playersCount = data.success ? (data.players ? data.players.length : 0) : 0;
            
            playersCountElement.textContent = `(${playersCount})`;
            
            if (data.success && data.players.length > 0) {
                container.innerHTML = data.players.map(player => {
                    const defaultAvatar = 'https://mc-heads.net/avatar/8667ba71-b85a-4004-af54-457fa973f346/40';
                    const avatarUrl = player.avatar || (player.uuid ? `https://mc-heads.net/avatar/${player.uuid}/40` : defaultAvatar);
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

function togglePlayerMenu(playerName, event) {
    const menu = document.getElementById(`menu-${playerName}`);
    if (!menu) return;
    
    if (activePlayerMenu === menu) {
        menu.classList.remove('active');
        activePlayerMenu = null;
        return;
    }

    if (activePlayerMenu) {
        activePlayerMenu.classList.remove('active');
    }
    
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.left = (rect.left) + 'px';
    
    menu.classList.add('active');
    activePlayerMenu = menu;
}

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
        if (reason === null) return;
        
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
