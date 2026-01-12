/**
 * Модуль для работы с командами и пользовательскими командами
 */

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

const MAX_VISIBLE_COMMANDS = 12; // Максимальное количество команд, отображаемых по умолчанию

function renderQuickCommands() {
    const mainContainer = document.getElementById('main-quick-commands');
    
    if (!mainContainer) {
        console.log('Main container not found');
        return;
    }
    
    const defaultCommands = [
        {label: 'Ясная погода', command: 'weather clear'},
        {label: 'Дождь', command: 'weather rain'},
        {label: 'Гроза', command: 'weather thunder'}
    ];

    if (typeof customCommands === 'undefined') {
        customCommands = [];
    }
    
    const allCommands = [...defaultCommands, ...customCommands];
    const totalCommands = allCommands.length;
    const visibleCommands = allCommands.slice(0, MAX_VISIBLE_COMMANDS);
    const hiddenCommands = allCommands.slice(MAX_VISIBLE_COMMANDS);
    
    mainContainer.innerHTML = '';
    
    // Отображаем видимые команды
    visibleCommands.forEach((cmd, index) => {
        const div = document.createElement('div');
        div.className = 'quick-command';
        div.onclick = () => sendCommand(cmd.command);
        div.textContent = cmd.label;
        
        // Добавляем кнопку удаления только для пользовательских команд
        if (index >= defaultCommands.length) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Удалить';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteCommand(index - defaultCommands.length);
            };
            div.appendChild(deleteBtn);
        }
        
        mainContainer.appendChild(div);
    });
    
    // Если есть скрытые команды, добавляем кнопку "+" для доступа к остальным командам
    if (hiddenCommands.length > 0) {
        const moreBtn = document.createElement('div');
        moreBtn.className = 'quick-command more-commands-btn';
        moreBtn.innerHTML = '<span style="font-size: 1.2em; font-weight: bold;">+</span>';
        moreBtn.title = `Еще ${hiddenCommands.length} команд`;
        moreBtn.onclick = () => openCommandsMenu(hiddenCommands);
        mainContainer.appendChild(moreBtn);
    }
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

document.addEventListener('click', function(event) {
    const addModal = document.getElementById('add-command-modal');
    const commandsModal = document.getElementById('commands-menu-modal');
    if (event.target === addModal) {
        closeAddCommandModal();
    }
    if (event.target === commandsModal) {
        closeCommandsMenu();
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const addModal = document.getElementById('add-command-modal');
        const commandsModal = document.getElementById('commands-menu-modal');
        if (addModal.classList.contains('active')) {
            closeAddCommandModal();
        }
        if (commandsModal.classList.contains('active')) {
            closeCommandsMenu();
        }
    }
});

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

function deleteCommand(index) {
    customCommands.splice(index, 1);
    saveCustomCommands();
    renderQuickCommands();
}

function openCommandsMenu(hiddenCommands) {
    const modal = document.getElementById('commands-menu-modal');
    const listContainer = document.getElementById('commands-menu-list');
    const searchInput = document.getElementById('commands-search-input');
    
    // Сохраняем все команды для фильтрации
    const defaultCommands = [
        {label: 'Ясная погода', command: 'weather clear'},
        {label: 'Дождь', command: 'weather rain'},
        {label: 'Гроза', command: 'weather thunder'}
    ];
    const allCommands = [...defaultCommands, ...customCommands];
    
    function renderCommandsList(commandsToShow) {
        listContainer.innerHTML = '';
        
        if (commandsToShow.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Команды не найдены</div>';
            return;
        }
        
        commandsToShow.forEach((cmd, index) => {
            const cmdDiv = document.createElement('div');
            cmdDiv.className = 'commands-menu-item';
            cmdDiv.innerHTML = `
                <div class="commands-menu-item-label">${cmd.label}</div>
                <div class="commands-menu-item-command">${cmd.command}</div>
            `;
            cmdDiv.onclick = () => {
                sendCommand(cmd.command);
                closeCommandsMenu();
            };
            listContainer.appendChild(cmdDiv);
        });
    }
    
    // Инициализация поиска
    searchInput.value = '';
    searchInput.oninput = (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm === '') {
            renderCommandsList(allCommands);
        } else {
            const filtered = allCommands.filter(cmd => 
                cmd.label.toLowerCase().includes(searchTerm) || 
                cmd.command.toLowerCase().includes(searchTerm)
            );
            renderCommandsList(filtered);
        }
    };
    
    // Отображаем все команды по умолчанию
    renderCommandsList(allCommands);
    
    modal.classList.add('active');
    setTimeout(() => {
        searchInput.focus();
    }, 100);
}

function closeCommandsMenu() {
    const modal = document.getElementById('commands-menu-modal');
    const searchInput = document.getElementById('commands-search-input');
    modal.classList.remove('active');
    searchInput.value = '';
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

    if (window.commandHistory.length === 0 || window.commandHistory[window.commandHistory.length - 1] !== command) {
        window.commandHistory.push(command);
        if (window.commandHistory.length > 100) {
            window.commandHistory.shift();
        }
    }
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
            const response = data.response || 'Команда выполнена успешно';
            const lines = response.split('\n');
            if (lines.length > 1) {
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
