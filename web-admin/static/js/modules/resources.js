/**
 * Модуль для работы с ресурсами сервера
 */

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

                // RAM
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
                
                // Spark данные
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
                } else if (sparkSection) {
                    sparkSection.style.display = 'none';
                }
                
                // BlueMap доступность - показываем кнопку "Карта", если BlueMap доступен
                const mapTabBtn = document.getElementById('map-tab-btn');
                if (mapTabBtn) {
                    if (data.bluemap_available === true) {
                        mapTabBtn.style.display = '';
                        // Если это первая доступная вкладка и мы еще не переключились ни на одну, активируем её
                        const activeTab = document.querySelector('.tab.active');
                        if (!activeTab) {
                            const userRole = (window.userRole || 'guest');
                            if (userRole === 'guest') {
                                // Для гостя карта может быть первой доступной вкладкой
                                setTimeout(() => {
                                    if (typeof switchTab === 'function') {
                                        switchTab('map', mapTabBtn);
                                    }
                                }, 100);
                            }
                        }
                    } else {
                        mapTabBtn.style.display = 'none';
                        // Если мы на вкладке карты и BlueMap недоступен, переключаемся на другую вкладку
                        const mapTab = document.getElementById('map-tab');
                        if (mapTab && mapTab.classList.contains('active')) {
                            const firstAvailableTab = document.querySelector('.tab:not([style*="display: none"])');
                            if (firstAvailableTab && typeof switchTab === 'function') {
                                const tabName = firstAvailableTab.getAttribute('onclick').match(/switchTab\('(\w+)'/)[1];
                                switchTab(tabName, firstAvailableTab);
                            }
                        }
                    }
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
