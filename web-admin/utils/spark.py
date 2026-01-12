"""
Утилиты для работы со Spark healthreport
"""
import re
import time
from .rcon import send_rcon_command


def get_spark_data(rcon_host, rcon_port, rcon_password, lock, docker_client, container_name, use_spark_memory):
    """
    Получить данные из Spark через команду /spark healthreport (все данные в одном месте)
    
    Args:
        rcon_host: Хост RCON сервера
        rcon_port: Порт RCON сервера
        rcon_password: Пароль RCON
        lock: Блокировка для потокобезопасности
        docker_client: Docker клиент
        container_name: Имя контейнера Minecraft
        use_spark_memory: Использовать ли Spark для данных памяти
    
    Returns:
        dict: Данные Spark (tps, mspt, cpu, memory)
    """
    spark_data = {
        'available': False,
        'memory': {},
        'tps': {},
        'mspt': {},
        'cpu': {}
    }
    
    if not use_spark_memory:
        return spark_data
    
    try:
        # Используем команду /spark healthreport - она содержит все данные
        try:
            # Отправляем команду через RCON
            health_result = send_rcon_command('/spark healthreport', rcon_host, rcon_port, rcon_password, lock)
            
            # Ждем немного, чтобы Spark успел вывести данные в логи
            time.sleep(1)
            
            # Читаем логи сервера для получения данных Spark healthreport
            health_response = ''
            if docker_client:
                try:
                    container = docker_client.containers.get(container_name)
                    # Получаем последние 150 строк логов (healthreport может быть длинным)
                    logs = container.logs(tail=150, timestamps=False).decode('utf-8', errors='ignore')
                    
                    # Ищем данные Spark healthreport в логах
                    lines = logs.split('\n')
                    collecting = False
                    health_lines = []
                    
                    for i, line in enumerate(lines):
                        # Ищем начало вывода Spark healthreport
                        if 'Generating server health report' in line:
                            collecting = True
                            health_lines = []
                        elif collecting:
                            # Собираем все строки до следующей команды Spark или пустой строки после данных
                            line_stripped = line.strip()
                            
                            # Если предыдущая строка была заголовком TPS, обязательно берем следующую строку с данными
                            if health_lines and 'TPS from last' in health_lines[-1] and line_stripped:
                                health_lines.append(line)
                            elif '>' in line or '[⚡]' in line or \
                               (line_stripped and not line.startswith('[') and 
                                (any(x in line for x in ['TPS', 'Tick', 'CPU', 'Memory', 'Network', 'Disk', 'Garbage']) or
                                 any(x in line for x in ['GB', '%', '/', 'ms avg', 'collections']) or
                                 re.match(r'^[\d.*,\s]+$', line_stripped) or
                                 re.match(r'^[\d./\s;]+$', line_stripped))):
                                health_lines.append(line)
                            # Останавливаемся когда встречаем новую команду Spark
                            elif '[⚡]' in line and 'Generating' not in line and 'health report' not in line.lower():
                                break
                            # Заканчиваем на пустой строке после данных
                            elif line_stripped == '' and len(health_lines) > 10:
                                if i + 1 < len(lines):
                                    next_lines = lines[i+1:i+3]
                                    if not any('>' in l or '[⚡]' in l or any(x in l for x in ['TPS', 'Tick', 'CPU', 'Memory', 'GB', '%']) or (l.strip() and re.match(r'^[\d.*,\s]+$', l.strip())) for l in next_lines):
                                        break
                    
                    if health_lines:
                        health_response = '\n'.join(health_lines)
                        print(f"Found Spark healthreport data in logs: {len(health_lines)} lines")
                except Exception as log_error:
                    print(f"Error reading healthreport logs: {log_error}")
            
            # Также проверяем RCON ответ (на случай если он все же вернул данные)
            if not health_response and health_result.get('success', False):
                health_response = health_result.get('response', '')
            
            if health_response and len(health_response.strip()) > 0:
                spark_data['available'] = True
                
                print(f"Spark healthreport response (first 1500 chars): {health_response[:1500]}")
                
                # Парсим TPS данные
                tps_match = re.search(r'>\s*TPS from last[^\n]*\n\s+(\*?\d+\.\d+),\s+(\*?\d+\.\d+),\s+(\*?\d+\.\d+),\s+(\*?\d+\.\d+),\s+(\*?\d+\.\d+)', health_response)
                if not tps_match:
                    # Альтернативный вариант - ищем строку с TPS и следующую строку с данными
                    tps_header_match = re.search(r'>\s*TPS from last[^\n]*', health_response)
                    if tps_header_match:
                        after_tps = health_response[tps_header_match.end():]
                        tps_data_match = re.search(r'\n\s+(\*?\d+\.\d+),\s+(\*?\d+\.\d+),\s+(\*?\d+\.\d+),\s+(\*?\d+\.\d+),\s+(\*?\d+\.\d+)', after_tps)
                        if tps_data_match:
                            tps_match = tps_data_match
                
                if tps_match:
                    spark_data['tps'] = {
                        'fiveSeconds': float(tps_match.group(1).replace('*', '')),
                        'tenSeconds': float(tps_match.group(2).replace('*', '')),
                        'oneMinute': float(tps_match.group(3).replace('*', '')),
                        'fiveMinutes': float(tps_match.group(4).replace('*', '')),
                        'fifteenMinutes': float(tps_match.group(5).replace('*', '')),
                        'current': float(tps_match.group(2).replace('*', ''))
                    }
                    print(f"Parsed TPS: {spark_data['tps']}")
                else:
                    print(f"Warning: Could not parse TPS data. Health response snippet: {health_response[:500]}")
                
                # Парсим MSPT данные
                mspt_match = re.search(r'>\s*Tick durations[^\n]*\n\s+([\d.]+)/([\d.]+)/([\d.]+)/([\d.]+);\s*([\d.]+)/([\d.]+)/([\d.]+)/([\d.]+)', health_response)
                if mspt_match:
                    spark_data['mspt'] = {
                        'tenSeconds': {
                            'min': float(mspt_match.group(1)),
                            'median': float(mspt_match.group(2)),
                            'p95': float(mspt_match.group(3)),
                            'max': float(mspt_match.group(4))
                        },
                        'oneMinute': {
                            'min': float(mspt_match.group(5)),
                            'median': float(mspt_match.group(6)),
                            'p95': float(mspt_match.group(7)),
                            'max': float(mspt_match.group(8))
                        }
                    }
                    print(f"Parsed MSPT: {spark_data['mspt']}")
                
                # Парсим CPU данные для system
                cpu_system_match = re.search(r'>\s*CPU usage[^\n]*\n\s*(\d+)%,\s*(\d+)%,\s*(\d+)%\s+\(system\)', health_response)
                if cpu_system_match:
                    spark_data['cpu'] = {
                        'system': {
                            'tenSeconds': float(cpu_system_match.group(1)),
                            'oneMinute': float(cpu_system_match.group(2)),
                            'fifteenMinutes': float(cpu_system_match.group(3))
                        }
                    }
                    print(f"Parsed CPU system: {spark_data['cpu']['system']}")
                
                # Парсим CPU данные для process
                cpu_process_match = re.search(r'\(system\)[^\n]*\n\s*(\d+)%,\s*(\d+)%,\s*(\d+)%\s+\(process\)', health_response)
                if cpu_process_match:
                    if 'cpu' not in spark_data:
                        spark_data['cpu'] = {}
                    spark_data['cpu']['process'] = {
                        'tenSeconds': float(cpu_process_match.group(1)),
                        'oneMinute': float(cpu_process_match.group(2)),
                        'fifteenMinutes': float(cpu_process_match.group(3))
                    }
                    print(f"Parsed CPU process: {spark_data['cpu']['process']}")
                
                # Парсим данные о памяти
                memory_match = re.search(r'>\s*Memory usage:\s*\n\s*([\d.]+)\s+GB\s+/\s+([\d.]+)\s+GB\s+\((\d+)%\)', health_response)
                if memory_match:
                    heap_used_gb = float(memory_match.group(1))
                    heap_max_gb = float(memory_match.group(2))
                    spark_data['memory'] = {
                        'heap': {
                            'used': int(heap_used_gb * (1024**3)),
                            'max': int(heap_max_gb * (1024**3)),
                            'free': int((heap_max_gb - heap_used_gb) * (1024**3))
                        }
                    }
                    print(f"Parsed heap memory: used={heap_used_gb} GB, max={heap_max_gb} GB")
                
        except Exception as e:
            print(f"Ошибка при получении данных из команды Spark healthreport: {e}")
            import traceback
            traceback.print_exc()
        
        # Финальная проверка: если нет никаких данных, не помечаем как available
        if spark_data['available']:
            has_data = bool(spark_data.get('tps') or spark_data.get('mspt') or 
                           spark_data.get('cpu') or spark_data.get('memory', {}).get('heap'))
            if not has_data:
                print("Spark marked as available but no data was parsed - marking as unavailable")
                spark_data['available'] = False
        
    except Exception as e:
        print(f"Ошибка обработки данных Spark команд: {e}")
        import traceback
        traceback.print_exc()
    
    return spark_data
