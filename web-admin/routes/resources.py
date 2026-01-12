"""
Blueprint для ресурсов сервера (CPU, RAM, TPS, MSPT)
"""
from flask import Blueprint, request, jsonify
import os
from routes.auth import login_required
from utils.rcon import send_rcon_command
from utils.docker_utils import get_container_stats
from utils.spark import get_spark_data

resources_bp = Blueprint('resources', __name__)

# Конфигурация
RCON_HOST = os.getenv('RCON_HOST', 'minecraft-server')
RCON_PORT = int(os.getenv('RCON_PORT', '25575'))
RCON_PASSWORD = os.getenv('RCON_PASSWORD', 'minecraft123')
MINECRAFT_CONTAINER_NAME = os.getenv('MINECRAFT_CONTAINER_NAME', 'minecraft-server')
USE_SPARK_MEMORY = os.getenv('USE_SPARK_MEMORY', 'false').lower() == 'true'

# Импортируем lock и docker_client из app.py через глобальные переменные
rcon_lock = None
docker_client = None


def init_resources_bp(lock, client):
    """Инициализация blueprint с lock для RCON и Docker клиентом"""
    global rcon_lock, docker_client
    rcon_lock = lock
    docker_client = client


@resources_bp.route('/api/status', methods=['GET'])
@login_required(role='guest')
def get_status():
    """Получить статус сервера"""
    try:
        result = send_rcon_command('list', RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock)
        return jsonify({'success': True, 'online': True, 'response': result.get('response', '')})
    except:
        return jsonify({'success': False, 'online': False})


@resources_bp.route('/api/resources', methods=['GET'])
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
                stats = get_container_stats(docker_client, MINECRAFT_CONTAINER_NAME)
                cpu_percent = stats['cpu_percent']
                ram_used = stats['ram_used']
                ram_total = stats['ram_total']
                ram_percent = stats['ram_percent']
            except Exception as e:
                return jsonify({
                    'success': False, 
                    'error': str(e),
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
        spark_data = get_spark_data(
            RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock,
            docker_client, MINECRAFT_CONTAINER_NAME, USE_SPARK_MEMORY
        )
        
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
