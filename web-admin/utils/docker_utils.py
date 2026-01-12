"""
Утилиты для работы с Docker API
"""
import docker
import re


def parse_memory_size(memory_str):
    """
    Парсит строку вида '2G', '512M' в байты
    
    Args:
        memory_str: Строка с размером памяти (например, "2G", "512M")
    
    Returns:
        float: Размер в байтах
    """
    memory_str = memory_str.upper().strip()
    if memory_str.endswith('G'):
        return float(memory_str[:-1]) * (1024**3)
    elif memory_str.endswith('M'):
        return float(memory_str[:-1]) * (1024**2)
    elif memory_str.endswith('K'):
        return float(memory_str[:-1]) * 1024
    else:
        return float(memory_str) * (1024**3)  # По умолчанию GB


def get_container_stats(docker_client, container_name):
    """
    Получить статистику контейнера Docker
    
    Args:
        docker_client: Docker клиент
        container_name: Имя контейнера
    
    Returns:
        dict: Статистика контейнера или None при ошибке
    """
    if not docker_client:
        return None
    
    try:
        container = docker_client.containers.get(container_name)
        stats = container.stats(stream=False)
        
        # CPU процент - правильный расчет для Docker контейнера
        cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
        system_delta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
        num_cpus = stats['cpu_stats'].get('online_cpus', len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [])))
        
        cpu_percent = 0
        if system_delta > 0 and num_cpus > 0:
            cpu_percent = round((cpu_delta / system_delta) * num_cpus * 100.0, 2)
        
        # Получаем MEMORY из переменных окружения контейнера
        container_env = container.attrs.get('Config', {}).get('Env', [])
        memory_limit_str = '2G'  # По умолчанию
        for env_var in container_env:
            if env_var.startswith('MEMORY='):
                memory_limit_str = env_var.split('=', 1)[1]
                break
        
        # Парсим MEMORY (например, "2G" -> 2 GB)
        ram_total_bytes = parse_memory_size(memory_limit_str)
        ram_total = round(ram_total_bytes / (1024**3), 2)  # GB
        
        # RAM использование - получаем RSS память процесса Java
        ram_used = 0
        try:
            # Сначала получаем PID процесса Java
            pid_result = container.exec_run('sh -c "pgrep -f \"java.*server.jar\" | head -1"')
            if pid_result.exit_code == 0 and pid_result.output:
                pid = pid_result.output.decode('utf-8').strip()
                if pid:
                    # Получаем VmRSS из /proc/<pid>/status (более точный метод)
                    status_result = container.exec_run(f'sh -c "cat /proc/{pid}/status 2>/dev/null | grep VmRSS"')
                    if status_result.exit_code == 0 and status_result.output:
                        status_output = status_result.output.decode('utf-8').strip()
                        # Парсим "VmRSS:    1234567 kB"
                        rss_match = re.search(r'VmRSS:\s+(\d+)\s+kB', status_output)
                        if rss_match:
                            rss_kb = int(rss_match.group(1))
                            ram_used = round(rss_kb / (1024**2), 2)  # KB -> GB
                            # RSS память включает heap + метаспейс + стеки + нативные библиотеки
                            # Используем heap + 25% overhead как total для более реалистичного отображения
                            heap_gb = round(ram_total_bytes / (1024**3), 2)
                            ram_total = round(heap_gb * 1.25, 2)  # Heap + 25% overhead
                            # Если RSS больше нашего total, увеличиваем total до RSS + небольшой запас
                            if ram_used > ram_total:
                                ram_total = round(ram_used * 1.1, 2)  # RSS + 10% запас
                            print(f"Получена RSS память процесса Java через /proc/{pid}/status: {rss_kb} KB = {ram_used} GB, total: {ram_total} GB")
                        else:
                            raise Exception(f"Не удалось распарсить VmRSS из /proc/{pid}/status: {status_output}")
                    else:
                        # Fallback: используем ps aux
                        exec_result = container.exec_run('sh -c "ps aux | grep \"[j]ava.*server.jar\" | head -1"')
                        if exec_result.exit_code == 0 and exec_result.output:
                            output = exec_result.output.decode('utf-8').strip()
                            if output:
                                parts = output.split()
                                if len(parts) >= 6:
                                    rss_kb = int(parts[5])  # RSS в KB (колонка 6)
                                    ram_used = round(rss_kb / (1024**2), 2)  # KB -> GB
                                    heap_gb = round(ram_total_bytes / (1024**3), 2)
                                    ram_total = round(heap_gb * 1.25, 2)  # Heap + 25% overhead
                                    if ram_used > ram_total:
                                        ram_total = round(ram_used * 1.1, 2)
                                    print(f"Получена RSS память процесса Java через ps aux: {rss_kb} KB = {ram_used} GB, total: {ram_total} GB")
                                else:
                                    raise Exception(f"Не удалось распарсить вывод ps aux: {output}")
                            else:
                                raise Exception("Пустой вывод команды ps aux")
                        else:
                            raise Exception("Не удалось получить PID процесса Java")
                else:
                    raise Exception("PID процесса Java не найден")
            else:
                raise Exception("Не удалось найти процесс Java")
        except Exception as e:
            print(f"Ошибка при получении RSS памяти процесса Java: {e}")
            # Fallback: используем общую память контейнера, но ограничиваем MEMORY
            memory_stats = stats.get('memory_stats', {})
            ram_used_bytes = memory_stats.get('usage', 0)
            # Вычитаем примерный overhead системы (~300 MB)
            overhead_bytes = 300 * (1024**2)  # 300 MB
            ram_used_bytes_limited = max(0, ram_used_bytes - overhead_bytes)
            ram_used_bytes_limited = min(ram_used_bytes_limited, ram_total_bytes * 1.05)  # Максимум 105% от лимита
            ram_used = round(ram_used_bytes_limited / (1024**3), 2)  # GB
            ram_total = round(ram_total_bytes / (1024**3), 2)  # GB
        
        ram_percent = 0
        if ram_total > 0:
            ram_percent = round((ram_used / ram_total) * 100, 2)
        
        return {
            'cpu_percent': cpu_percent,
            'ram_used': ram_used,
            'ram_total': ram_total,
            'ram_percent': ram_percent
        }
    except docker.errors.NotFound:
        raise Exception(f'Контейнер {container_name} не найден')
    except Exception as e:
        print(f"Ошибка при получении Docker stats: {e}")
        raise


def get_container_logs(docker_client, container_name, tail=100):
    """
    Получить логи контейнера
    
    Args:
        docker_client: Docker клиент
        container_name: Имя контейнера
        tail: Количество последних строк логов
    
    Returns:
        list: Список строк логов
    """
    if not docker_client:
        raise Exception('Docker клиент не инициализирован')
    
    try:
        container = docker_client.containers.get(container_name)
        logs = container.logs(tail=tail, timestamps=False).decode('utf-8', errors='ignore')
        
        # Разбиваем логи на строки и фильтруем пустые
        log_lines = [line for line in logs.split('\n') if line.strip()]
        
        return log_lines
    except docker.errors.NotFound:
        raise Exception(f'Контейнер {container_name} не найден')
    except Exception as e:
        raise Exception(f'Ошибка получения логов: {str(e)}')
