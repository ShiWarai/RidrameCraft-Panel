"""
Blueprint для команд и пользовательских команд
"""
from flask import Blueprint, request, jsonify
import os
import json
from routes.auth import login_required
from utils.rcon import send_rcon_command

commands_bp = Blueprint('commands', __name__)

# Конфигурация RCON
RCON_HOST = os.getenv('RCON_HOST', 'minecraft-server')
RCON_PORT = int(os.getenv('RCON_PORT', '25575'))
RCON_PASSWORD = os.getenv('RCON_PASSWORD', 'minecraft123')

# Путь к файлу с пользовательскими командами
CUSTOM_COMMANDS_FILE = '/app/data/custom_commands.json'

# Импортируем lock из app.py через глобальную переменную
# Это будет установлено при регистрации blueprint
rcon_lock = None


def init_commands_bp(lock):
    """Инициализация blueprint с lock для RCON"""
    global rcon_lock
    rcon_lock = lock


def ensure_custom_commands_file():
    """Убедиться, что custom_commands.json существует"""
    # Создаём директорию если её нет
    os.makedirs(os.path.dirname(CUSTOM_COMMANDS_FILE), exist_ok=True)
    
    # Если файл не существует - создаём пустой JSON файл
    if not os.path.exists(CUSTOM_COMMANDS_FILE):
        with open(CUSTOM_COMMANDS_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)


@commands_bp.route('/api/command', methods=['POST'])
@login_required(role='admin')
def execute_command():
    """Выполнить команду через RCON"""
    data = request.json
    command = data.get('command', '')
    if not command:
        return jsonify({'success': False, 'error': 'Команда не указана'}), 400
    
    result = send_rcon_command(command, RCON_HOST, RCON_PORT, RCON_PASSWORD, rcon_lock)
    return jsonify(result)


@commands_bp.route('/api/custom-commands', methods=['GET'])
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


@commands_bp.route('/api/custom-commands', methods=['POST'])
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
