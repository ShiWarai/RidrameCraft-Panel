#!/usr/bin/env python3
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from functools import wraps
import socket
import struct
import os
import threading
import json
import re
import psutil
import requests
import docker
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'change-this-secret-key-in-production')
CORS(app)

# Отключаем кэширование для всех ответов в debug режиме
@app.after_request
def after_request(response):
    if app.debug:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

RCON_HOST = os.getenv('RCON_HOST', 'minecraft-server')
RCON_PORT = int(os.getenv('RCON_PORT', '25575'))
RCON_PASSWORD = os.getenv('RCON_PASSWORD', 'minecraft123')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')
MINECRAFT_CONTAINER_NAME = os.getenv('MINECRAFT_CONTAINER_NAME', 'minecraft-server')
USE_SPARK_MEMORY = os.getenv('USE_SPARK_MEMORY', 'false').lower() == 'true'

# Используем локальную блокировку для потокобезопасности
lock = threading.Lock()

# Путь к файлу с пользовательскими командами
CUSTOM_COMMANDS_FILE = '/app/data/custom_commands.json'

# Инициализация Docker клиента
try:
    docker_client = docker.from_env()
except:
    docker_client = None

def login_required(role='guest'):
    def wrapper(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'logged_in' not in session or not session['logged_in']:
                return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
            
            user_role = session.get('role', 'guest')
            if role == 'admin' and user_role != 'admin':
                return jsonify({'success': False, 'error': 'Недостаточно прав'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return wrapper

def send_rcon_command(command):
    try:
        with lock:
            # Создаем сокет
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((RCON_HOST, RCON_PORT))
            
            # Отправляем пакет аутентификации
            request_id = 1
            packet = struct.pack('<ii', request_id, 3)  # 3 = SERVERDATA_AUTH
            packet += RCON_PASSWORD.encode('utf-8') + b'\x00\x00'
            packet = struct.pack('<i', len(packet)) + packet
            sock.sendall(packet)
            
            # Получаем ответ на аутентификацию
            response_len = struct.unpack('<i', sock.recv(4))[0]
            response = sock.recv(response_len)
            
            # Отправляем команду
            request_id = 2
            packet = struct.pack('<ii', request_id, 2)  # 2 = SERVERDATA_EXECCOMMAND
            packet += command.encode('utf-8') + b'\x00\x00'
            packet = struct.pack('<i', len(packet)) + packet
            sock.sendall(packet)
            
            # Получаем ответ
            response_len = struct.unpack('<i', sock.recv(4))[0]
            response = sock.recv(response_len)
            
            # Парсим ответ
            response_id, response_type = struct.unpack('<ii', response[:8])
            response_text = response[8:-2].decode('utf-8')
            
            sock.close()
            return {'success': True, 'response': response_text}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@app.route('/')
def index():
    if 'logged_in' not in session or not session['logged_in']:
        return render_template('login.html')
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password', '')
    is_guest = data.get('guest', False)
    
    if is_guest:
        session['logged_in'] = True
        session['role'] = 'guest'
        return jsonify({'success': True, 'role': 'guest'})
        
    if password == ADMIN_PASSWORD:
        session['logged_in'] = True
        session['role'] = 'admin'
        return jsonify({'success': True, 'role': 'admin'})
    return jsonify({'success': False, 'error': 'Неверный пароль'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('logged_in', None)
    return jsonify({'success': True})

@app.route('/api/command', methods=['POST'])
@login_required(role='admin')
def execute_command():
    data = request.json
    command = data.get('command', '')
    if not command:
        return jsonify({'success': False, 'error': 'Команда не указана'}), 400
    
    result = send_rcon_command(command)
    return jsonify(result)

@app.route('/api/status', methods=['GET'])
@login_required(role='guest')
def get_status():
    try:
        result = send_rcon_command('list')
        return jsonify({'success': True, 'online': True, 'response': result.get('response', '')})
    except:
        return jsonify({'success': False, 'online': False})

@app.route('/api/players', methods=['GET'])
@login_required(role='guest')
def get_players():
    """Получить список игроков с их UUID и аватарами"""
    try:
        result = send_rcon_command('list')
        if not result['success']:
            return jsonify({'success': False, 'players': []})
        
        response_text = result['response']
        # Парсим ответ вида "There are X of a max of Y players online: player1, player2"
        players = []
        
        # Извлекаем список игроков из ответа
        match = re.search(r'online:\s*(.+)$', response_text)
        if match and match.group(1).strip():
            player_names = [p.strip() for p in match.group(1).split(',') if p.strip()]
            
            for name in player_names:
                # Получаем UUID игрока через Mojang API
                uuid = get_player_uuid(name)
                avatar_url = None
                if uuid:
                    # Форматируем UUID с дефисами если нужно
                    if len(uuid) == 32 and '-' not in uuid:
                        uuid = f"{uuid[:8]}-{uuid[8:12]}-{uuid[12:16]}-{uuid[16:20]}-{uuid[20:]}"
                    # Используем mc-heads.net как альтернативу Crafatar
                    avatar_url = f'https://mc-heads.net/avatar/{uuid}/40'
                
                players.append({
                    'name': name,
                    'uuid': uuid,
                    'avatar': avatar_url
                })
        
        return jsonify({'success': True, 'players': players})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'players': []})

@app.route('/api/player-action', methods=['POST'])
@login_required(role='admin')
def player_action():
    """Выполнить действие над игроком (kick, kill, ban, op, deop)"""
    try:
        data = request.json
        player_name = data.get('player')
        action = data.get('action')  # 'kick', 'kill', 'ban', 'op', 'deop'
        
        if not player_name or not action:
            return jsonify({'success': False, 'error': 'Не указаны игрок или действие'})
        
        if action not in ['kick', 'kill', 'ban', 'op', 'deop', 'creative', 'survival', 'spectator']:
            return jsonify({'success': False, 'error': 'Неизвестное действие'})
        
        # Формируем команду в зависимости от действия
        if action == 'kick':
            reason = data.get('reason', 'Выгнан администратором')
            command = f'kick {player_name} {reason}'
        elif action == 'kill':
            command = f'kill {player_name}'
        elif action == 'ban':
            reason = data.get('reason', 'Забанен администратором')
            command = f'ban {player_name} {reason}'
        elif action == 'op':
            command = f'op {player_name}'
        elif action == 'deop':
            command = f'deop {player_name}'
        elif action == 'creative':
            command = f'gamemode creative {player_name}'
        elif action == 'survival':
            command = f'gamemode survival {player_name}'
        elif action == 'spectator':
            command = f'gamemode spectator {player_name}'
        
        result = send_rcon_command(command)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def get_player_uuid(username):
    """Получить UUID игрока через Mojang API"""
    try:
        response = requests.get(f'https://api.mojang.com/users/profiles/minecraft/{username}', timeout=3)
        if response.status_code == 200:
            data = response.json()
            uuid = data.get('id', None)
            if uuid:
                # Форматируем UUID с дефисами для Crafatar API
                # UUID приходит без дефисов: 1154fa6921a541d8a989190fd2fc3e04
                # Нужно: 1154fa69-21a5-41d8-a989-190fd2fc3e04
                if len(uuid) == 32 and '-' not in uuid:
                    uuid = f"{uuid[:8]}-{uuid[8:12]}-{uuid[12:16]}-{uuid[16:20]}-{uuid[20:]}"
                return uuid
    except Exception as e:
        print(f"Error getting UUID for {username}: {e}")
    return None

def parse_memory_size(memory_str):
    """Парсит строку вида '2G', '512M' в байты"""
    memory_str = memory_str.upper().strip()
    if memory_str.endswith('G'):
        return float(memory_str[:-1]) * (1024**3)
    elif memory_str.endswith('M'):
        return float(memory_str[:-1]) * (1024**2)
    elif memory_str.endswith('K'):
        return float(memory_str[:-1]) * 1024
    else:
        return float(memory_str) * (1024**3)  # По умолчанию GB

def get_spark_data():
    """Получить данные из Spark через команду /spark healthreport (все данные в одном месте)"""
    spark_data = {
        'available': False,
        'memory': {},
        'tps': {},
        'mspt': {},
        'cpu': {}
    }
    
    if not USE_SPARK_MEMORY:
        return spark_data
    
    try:
        import time
        
        # Используем команду /spark healthreport - она содержит все данные
        try:
            # Отправляем команду через RCON
            health_result = send_rcon_command('/spark healthreport')
            
            # Ждем немного, чтобы Spark успел вывести данные в логи
            time.sleep(1)
            
            # Читаем логи сервера для получения данных Spark healthreport
            health_response = ''
            if docker_client:
                try:
                    container = docker_client.containers.get(MINECRAFT_CONTAINER_NAME)
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

@app.route('/api/resources', methods=['GET'])
@login_required(role='guest')
def get_resources():
    """Получить информацию об использовании ресурсов контейнера Minecraft"""
    try:
        cpu_percent = 0
        ram_used = 0
        ram_total = 0
        ram_percent = 0
        
        if docker_client:
            try:
                container = docker_client.containers.get(MINECRAFT_CONTAINER_NAME)
                stats = container.stats(stream=False)
                
                # CPU процент - правильный расчет для Docker контейнера
                cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
                system_delta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
                num_cpus = stats['cpu_stats'].get('online_cpus', len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [])))
                if system_delta > 0 and num_cpus > 0:
                    cpu_percent = round((cpu_delta / system_delta) * num_cpus * 100.0, 2)
                else:
                    cpu_percent = 0
                
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
                # Для образа itzg/minecraft-server используем /proc/<pid>/status для более точного измерения
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
                                import re
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
                
                if ram_total > 0:
                    ram_percent = round((ram_used / ram_total) * 100, 2)
                else:
                    ram_percent = 0
                
            except docker.errors.NotFound:
                return jsonify({
                    'success': False, 
                    'error': f'Контейнер {MINECRAFT_CONTAINER_NAME} не найден',
                    'cpu': {'percent': 0},
                    'ram': {'used': 0, 'total': 0, 'percent': 0}
                })
            except Exception as e:
                print(f"Ошибка при получении Docker stats: {e}")
                return jsonify({
                    'success': False, 
                    'error': f'Ошибка получения статистики: {str(e)}',
                    'cpu': {'percent': 0},
                    'ram': {'used': 0, 'total': 0, 'percent': 0}
                })
        else:
            return jsonify({
                'success': False, 
                'error': 'Docker клиент не инициализирован',
                'cpu': {'percent': 0},
                'ram': {'used': 0, 'total': 0, 'percent': 0}
            })
        
        # Получаем данные Spark после получения Docker stats
        spark_data = get_spark_data()
        
        # Формируем ответ, приоритизируя данные Spark если они доступны
        response_data = {
            'success': True,
            'spark_available': spark_data.get('available', False),
            'cpu': {
                'percent': round(cpu_percent, 1)
            },
            'ram': {
                'used': round(ram_used, 2),
                'total': round(ram_total, 2),
                'percent': round(ram_percent, 1)
            }
        }
        
        # Если Spark доступен, используем его данные для CPU и RAM
        if spark_data.get('available'):
            # CPU из Spark (process)
            if spark_data.get('cpu', {}).get('process'):
                spark_cpu = spark_data['cpu']['process']
                response_data['cpu']['percent'] = round(spark_cpu.get('oneMinute', cpu_percent), 1)
            
            # RAM из Spark (heap)
            if spark_data.get('memory', {}).get('heap'):
                heap = spark_data['memory']['heap']
                response_data['ram']['used'] = round(heap['used'] / (1024**3), 2)
                response_data['ram']['total'] = round(heap['max'] / (1024**3), 2)
                if heap['max'] > 0:
                    response_data['ram']['percent'] = round((heap['used'] / heap['max']) * 100, 1)
        
        # Добавляем данные TPS и MSPT если они есть
        if spark_data.get('tps'):
            response_data['tps'] = spark_data['tps']
        else:
            response_data['tps'] = None
            
        if spark_data.get('mspt'):
            response_data['mspt'] = spark_data['mspt']
        else:
            response_data['mspt'] = None
        
        return jsonify(response_data)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/logs', methods=['GET'])
@login_required(role='admin')
def get_server_logs():
    """Получить логи сервера Minecraft"""
    try:
        tail = request.args.get('tail', 100, type=int)
        
        if not docker_client:
            return jsonify({'success': False, 'error': 'Docker клиент не инициализирован', 'logs': []})
        
        try:
            container = docker_client.containers.get(MINECRAFT_CONTAINER_NAME)
            logs = container.logs(tail=tail, timestamps=False).decode('utf-8', errors='ignore')
            
            # Разбиваем логи на строки и фильтруем пустые
            log_lines = [line for line in logs.split('\n') if line.strip()]
            
            return jsonify({'success': True, 'logs': log_lines})
        except docker.errors.NotFound:
            return jsonify({'success': False, 'error': f'Контейнер {MINECRAFT_CONTAINER_NAME} не найден', 'logs': []})
        except Exception as e:
            return jsonify({'success': False, 'error': f'Ошибка получения логов: {str(e)}', 'logs': []})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'logs': []})

def ensure_custom_commands_file():
    """Убедиться, что custom_commands.json существует"""
    # Создаём директорию если её нет
    os.makedirs(os.path.dirname(CUSTOM_COMMANDS_FILE), exist_ok=True)
    
    # Если файл не существует - создаём пустой JSON файл
    if not os.path.exists(CUSTOM_COMMANDS_FILE):
        with open(CUSTOM_COMMANDS_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)

@app.route('/api/custom-commands', methods=['GET'])
@login_required(role='guest')
def get_custom_commands():
    """Получить список пользовательских команд"""
    try:
        ensure_custom_commands_file()
        if os.path.exists(CUSTOM_COMMANDS_FILE):
            with open(CUSTOM_COMMANDS_FILE, 'r', encoding='utf-8') as f:
                commands = json.load(f)
                return jsonify({'success': True, 'commands': commands})
        return jsonify({'success': True, 'commands': []})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'commands': []})

@app.route('/api/custom-commands', methods=['POST'])
@login_required(role='admin')
def save_custom_commands():
    """Сохранить список пользовательских команд"""
    try:
        ensure_custom_commands_file()
        data = request.json
        commands = data.get('commands', [])
        
        with open(CUSTOM_COMMANDS_FILE, 'w', encoding='utf-8') as f:
            json.dump(commands, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def parse_banlist_response(response_text):
    """Парсит ответ команды banlist и возвращает список забаненных игроков"""
    players = []
    if not response_text:
        return players
    
    # Формат ответа может быть разным:
    # 1. "There are X banned players: player1, player2, player3" (старый формат)
    # 2. "There are X ban(s):\nvictor was banned by ShiWarai: Banned by an operator." (новый многострочный формат)
    # 3. "There are no banned players"
    
    response_lower = response_text.lower().strip()
    
    # Проверяем на пустой список
    if any(phrase in response_lower for phrase in ['no banned players', 'нет забаненных игроков', 'there are 0 ban']):
        return players
    
    lines = response_text.strip().split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Пропускаем служебные строки заголовка
        if any(phrase in line.lower() for phrase in ['there are', 'ban(s)', 'banned players']):
            # Но если в строке есть список игроков после двоеточия (старый формат), обрабатываем
            if ':' in line and 'was banned' not in line.lower():
                parts = line.split(':', 1)
                if len(parts) == 2:
                    player_list = parts[1].strip()
                    if player_list:
                        # Разделяем по запятым и очищаем
                        found_players = [p.strip() for p in player_list.split(',') if p.strip()]
                        if found_players:
                            players.extend(found_players)
            continue
        
        # Обрабатываем новый формат: "victor was banned by ShiWarai: Banned by an operator."
        # или "victor was banned by ShiWarai: reason"
        if 'was banned' in line.lower():
            # Извлекаем имя игрока из начала строки
            # Формат: "victor was banned by ..."
            parts = line.split(' was banned', 1)
            if len(parts) >= 1:
                player_name = parts[0].strip()
                # Убираем ANSI escape коды если есть
                import re
                player_name = re.sub(r'\x1b\[[0-9;]*m', '', player_name)
                if player_name and len(player_name) < 20:  # Имена игроков обычно короче
                    players.append(player_name)
            continue
        
        # Обрабатываем формат "player: reason" или "player: UUID"
        if ':' in line and 'was banned' not in line.lower():
            player_part = line.split(':', 1)[0].strip()
            # Убираем ANSI escape коды
            import re
            player_part = re.sub(r'\x1b\[[0-9;]*m', '', player_part)
            # Проверяем, что это похоже на имя игрока
            if player_part and len(player_part) < 20 and not any(phrase in player_part.lower() for phrase in ['banned', 'operator', 'reason', 'uuid', 'there are']):
                players.append(player_part)
            continue
        
        # Если строка похожа на имя игрока (просто имя без дополнительной информации)
        if not any(phrase in line.lower() for phrase in ['banned', 'operator', 'reason', 'uuid', 'there are', 'was banned']):
            # Убираем ANSI escape коды
            import re
            clean_line = re.sub(r'\x1b\[[0-9;]*m', '', line)
            if len(clean_line) < 20 and clean_line.replace('_', '').replace('-', '').replace(' ', '').isalnum():
                players.append(clean_line)
    
    # Удаляем дубликаты, сохраняя порядок
    seen = set()
    unique_players = []
    for player in players:
        player_lower = player.lower()
        if player_lower not in seen:
            seen.add(player_lower)
            unique_players.append(player)
    
    return unique_players

def parse_whitelist_response(response_text):
    """Парсит ответ команды whitelist list и возвращает список игроков в whitelist"""
    players = []
    if not response_text:
        return players
    
    # Формат ответа: "There are X whitelisted players: player1, player2, player3"
    # Или: "There are no whitelisted players"
    lines = response_text.strip().split('\n')
    for line in lines:
        if 'no whitelisted players' in line.lower() or 'нет игроков в белом списке' in line.lower():
            return players
        
        # Ищем строку с игроками
        if ':' in line:
            parts = line.split(':', 1)
            if len(parts) == 2:
                player_list = parts[1].strip()
                if player_list:
                    # Разделяем по запятым и очищаем
                    players = [p.strip() for p in player_list.split(',') if p.strip()]
    
    return players

@app.route('/api/banlist', methods=['GET'])
@login_required(role='admin')
def get_banlist():
    """Получить список забаненных игроков с UUID и аватарами"""
    try:
        result = send_rcon_command('banlist')
        if not result['success']:
            return jsonify({'success': False, 'error': result.get('error', 'Ошибка получения банлиста'), 'players': []})
        
        players = parse_banlist_response(result.get('response', ''))
        
        # Получаем UUID и аватары для каждого игрока
        players_with_data = []
        for player_name in players:
            uuid = get_player_uuid(player_name)
            avatar_url = None
            if uuid:
                # Форматируем UUID с дефисами если нужно
                if len(uuid) == 32 and '-' not in uuid:
                    uuid = f"{uuid[:8]}-{uuid[8:12]}-{uuid[12:16]}-{uuid[16:20]}-{uuid[20:]}"
                # Используем mc-heads.net как альтернативу Crafatar
                avatar_url = f'https://mc-heads.net/avatar/{uuid}/40'
            
            players_with_data.append({
                'name': player_name,
                'uuid': uuid,
                'avatar': avatar_url
            })
        
        return jsonify({'success': True, 'players': players_with_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'players': []})

@app.route('/api/whitelist', methods=['GET'])
@login_required(role='admin')
def get_whitelist():
    """Получить список игроков в whitelist с UUID и аватарами"""
    try:
        result = send_rcon_command('whitelist list')
        if not result['success']:
            return jsonify({'success': False, 'error': result.get('error', 'Ошибка получения whitelist'), 'players': []})
        
        players = parse_whitelist_response(result.get('response', ''))
        
        # Получаем UUID и аватары для каждого игрока
        players_with_data = []
        for player_name in players:
            uuid = get_player_uuid(player_name)
            avatar_url = None
            if uuid:
                # Форматируем UUID с дефисами если нужно
                if len(uuid) == 32 and '-' not in uuid:
                    uuid = f"{uuid[:8]}-{uuid[8:12]}-{uuid[12:16]}-{uuid[16:20]}-{uuid[20:]}"
                # Используем mc-heads.net как альтернативу Crafatar
                avatar_url = f'https://mc-heads.net/avatar/{uuid}/40'
            
            players_with_data.append({
                'name': player_name,
                'uuid': uuid,
                'avatar': avatar_url
            })
        
        return jsonify({'success': True, 'players': players_with_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'players': []})

@app.route('/api/banlist', methods=['POST'])
@login_required(role='admin')
def manage_banlist():
    """Управление банлистом (добавление/удаление игроков)"""
    try:
        data = request.json
        action = data.get('action')  # 'add' или 'remove'
        player = data.get('player', '').strip()
        reason = data.get('reason', 'Забанен администратором')
        
        if not player:
            return jsonify({'success': False, 'error': 'Не указан игрок'})
        
        if action == 'add':
            command = f'ban {player} {reason}'
        elif action == 'remove':
            command = f'pardon {player}'
        else:
            return jsonify({'success': False, 'error': 'Неизвестное действие. Используйте "add" или "remove"'})
        
        result = send_rcon_command(command)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/whitelist', methods=['POST'])
@login_required(role='admin')
def manage_whitelist():
    """Управление whitelist (добавление/удаление игроков)"""
    try:
        data = request.json
        action = data.get('action')  # 'add' или 'remove'
        player = data.get('player', '').strip()
        
        if not player:
            return jsonify({'success': False, 'error': 'Не указан игрок'})
        
        if action == 'add':
            command = f'whitelist add {player}'
        elif action == 'remove':
            command = f'whitelist remove {player}'
        else:
            return jsonify({'success': False, 'error': 'Неизвестное действие. Используйте "add" или "remove"'})
        
        result = send_rcon_command(command)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    # Включаем debug режим для автоматической перезагрузки при изменениях файлов
    # use_reloader=True перезагружает приложение при изменении файлов
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=True, use_debugger=True)

