/**
 * Модуль для работы с банлистом и whitelist
 */

let banlistAutoRefreshInterval = null;
let banlistUpdateInProgress = false;

function refreshBanlistAndWhitelist() {
    if (banlistUpdateInProgress) {
        return;
    }
    loadBanlist(false);
    loadWhitelist(false);
}

function toggleBanlistAutoRefresh(enable) {
    if (banlistAutoRefreshInterval) {
        clearInterval(banlistAutoRefreshInterval);
        banlistAutoRefreshInterval = null;
    }
    
    if (enable) {
        banlistAutoRefreshInterval = setInterval(refreshBanlistAndWhitelist, 5000);
    }
}

function updateBanlistAfterChange() {
    banlistUpdateInProgress = true;
    loadBanlist(false);
    loadWhitelist(false);
    setTimeout(() => {
        banlistUpdateInProgress = false;
    }, 1000);
}

async function loadBanlist(showLoading = true) {
    const container = document.getElementById('banlist-container');
    
    const oldContent = container.innerHTML;
    const isEmpty = oldContent.includes('empty-state') && (oldContent.includes('Загрузка') || oldContent.trim() === '');
    
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
                            ${(window.userRole || 'guest') === 'admin' ? `<button onclick="removeFromBanlist('${playerEscaped}')" style="padding: 6px 12px; background: #ff5555; color: white; border: 2px solid #000; border-radius: 0; cursor: pointer; font-size: 0.85em; font-weight: 600; box-shadow: inset -2px -2px 0 rgba(0,0,0,0.4), inset 2px 2px 0 rgba(255,255,255,0.15);">Разбанить</button>` : ''}
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
    if ((window.userRole || 'guest') !== 'admin') {
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
    if ((window.userRole || 'guest') !== 'admin') {
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

async function loadWhitelist(showLoading = true) {
    const container = document.getElementById('whitelist-container');
    
    const oldContent = container.innerHTML;
    const isEmpty = oldContent.includes('empty-state') && (oldContent.includes('Загрузка') || oldContent.trim() === '');
    
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
                            ${window.userRole === 'admin' ? `<button onclick="removeFromWhitelist('${playerEscaped}')" style="padding: 6px 12px; background: #ff5555; color: white; border: 2px solid #000; border-radius: 0; cursor: pointer; font-size: 0.85em; font-weight: 600; box-shadow: inset -2px -2px 0 rgba(0,0,0,0.4), inset 2px 2px 0 rgba(255,255,255,0.15);">Удалить</button>` : ''}
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
    if ((window.userRole || 'guest') !== 'admin') {
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
    if ((window.userRole || 'guest') !== 'admin') {
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

// Обработчики Enter для полей ввода
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
