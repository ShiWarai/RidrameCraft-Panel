"""
Blueprint для банлиста и whitelist
"""
from flask import Blueprint, request, jsonify
import os
from routes.auth import login_required
from utils.rcon import send_rcon_command, parse_banlist_response, parse_whitelist_response
from utils.mojang import get_player_uuid, get_player_avatar_url

banlist_bp = Blueprint('banlist', __name__)

# Конфигурация RCON
RCON_HOST = os.getenv('RCON_HOST', 'minecraft-server')
RCON_PORT = int(os.getenv('RCON_PORT', '25575'))
RCON_PASSWORD = os.getenv('RCON_PASSWORD', 'minecraft123')

# Импортируем lock из app.py через глобальную переменную
rcon_lock = None


def init_banlist_bp(lock):
    """Инициализация blueprint с lock для RCON"""
    global rcon_lock
    rcon_lock = lock


@banlist_bp.route('/api/banlist', methods=['GET'])
@login_required(role='admin')
def get_banlist():
    """Получить список забаненных игроков с UUID и аватарами"""
    try:
        result = send_rcon_command('banlist', RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock)
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
                avatar_url = get_player_avatar_url(uuid, 40)
            
            players_with_data.append({
                'name': player_name,
                'uuid': uuid,
                'avatar': avatar_url
            })
        
        return jsonify({'success': True, 'players': players_with_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'players': []})


@banlist_bp.route('/api/whitelist', methods=['GET'])
@login_required(role='admin')
def get_whitelist():
    """Получить список игроков в whitelist с UUID и аватарами"""
    try:
        result = send_rcon_command('whitelist list', RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock)
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
                avatar_url = get_player_avatar_url(uuid, 40)
            
            players_with_data.append({
                'name': player_name,
                'uuid': uuid,
                'avatar': avatar_url
            })
        
        return jsonify({'success': True, 'players': players_with_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'players': []})


@banlist_bp.route('/api/banlist', methods=['POST'])
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
        
        result = send_rcon_command(command, RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@banlist_bp.route('/api/whitelist', methods=['POST'])
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
        
        result = send_rcon_command(command, RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
