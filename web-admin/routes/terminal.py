"""
Blueprint для терминала (логов сервера)
"""
from flask import Blueprint, request, jsonify
import os
from routes.auth import login_required
from utils.docker_utils import get_container_logs

terminal_bp = Blueprint('terminal', __name__)

MINECRAFT_CONTAINER_NAME = os.getenv('MINECRAFT_CONTAINER_NAME', 'minecraft-server')

# Docker клиент будет установлен при регистрации blueprint
docker_client = None


def init_terminal_bp(client):
    """Инициализация blueprint с Docker клиентом"""
    global docker_client
    docker_client = client


@terminal_bp.route('/api/logs', methods=['GET'])
@login_required(role='admin')
def get_server_logs():
    """Получить логи сервера Minecraft"""
    try:
        tail = request.args.get('tail', 100, type=int)
        
        if not docker_client:
            return jsonify({'success': False, 'error': 'Docker клиент не инициализирован', 'logs': []})
        
        try:
            log_lines = get_container_logs(docker_client, MINECRAFT_CONTAINER_NAME, tail)
            return jsonify({'success': True, 'logs': log_lines})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e), 'logs': []})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'logs': []})
