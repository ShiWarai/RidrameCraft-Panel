/**
 * Модуль для работы с терминалом (логами сервера)
 */

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
                        formattedText = formattedText.replace(/\[([^\]]*\/FATAL[^\]]*)\]/gi, '<span style="color: #f44336; font-weight: bold;">[$1]</span>');
                        formattedText = formattedText.replace(/\[([^\]]*\/ERROR[^\]]*)\]/gi, '<span style="color: #f48771; font-weight: bold;">[$1]</span>');
                        formattedText = formattedText.replace(/\[([^\]]*\/WARN[^\]]*)\]/gi, '<span style="color: #ff9800; font-weight: bold;">[$1]</span>');
                        formattedText = formattedText.replace(/\[([^\]]*\/DEBUG[^\]]*)\]/gi, '<span style="color: #888;">[$1]</span>');
                        formattedText = formattedText.replace(/\[([^\]]*\/INFO[^\]]*)\]/gi, '<span style="color: #569cd6;">[$1]</span>');
                        
                        // 3. Подсветка временных меток в формате [HH:MM:SS]
                        formattedText = formattedText.replace(/(\[\d{2}:\d{2}:\d{2}\])/g, function(match, p1, offset, string) {
                            const before = string.substring(Math.max(0, offset - 100), offset);
                            if (!before.match(/<span[^>]*>[\s\S]*$/)) {
                                return '<span style="color: #888;">' + p1 + '</span>';
                            }
                            return match;
                        });
                        
                        // 4. Подсветка потоков Minecraft
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
