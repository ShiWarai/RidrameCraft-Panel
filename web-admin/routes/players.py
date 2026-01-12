"""
Blueprint для работы с игроками
"""
from flask import Blueprint, request, jsonify
import re
import os
from routes.auth import login_required
from utils.rcon import send_rcon_command
from utils.mojang import get_player_uuid, get_player_avatar_url

players_bp = Blueprint('players', __name__)

# Конфигурация RCON
RCON_HOST = os.getenv('RCON_HOST', 'minecraft-server')
RCON_PORT = int(os.getenv('RCON_PORT', '25575'))
RCON_PASSWORD = os.getenv('RCON_PASSWORD', 'minecraft123')

# Импортируем lock из app.py через глобальную переменную
rcon_lock = None


def init_players_bp(lock):
    """Инициализация blueprint с lock для RCON"""
    global rcon_lock
    rcon_lock = lock


@players_bp.route('/api/players', methods=['GET'])
@login_required(role='guest')
def get_players():
    """Получить список игроков с их UUID и аватарами"""
    try:
        result = send_rcon_command('list', RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock)
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
                    avatar_url = get_player_avatar_url(uuid, 40)
                
                players.append({
                    'name': name,
                    'uuid': uuid,
                    'avatar': avatar_url
                })
        
        return jsonify({'success': True, 'players': players})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'players': []})


@players_bp.route('/api/player-action', methods=['POST'])
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
        
        result = send_rcon_command(command, RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
