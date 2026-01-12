#!/usr/bin/env python3
"""
Главный файл Flask приложения для веб-админки Minecraft сервера
"""
from flask import Flask, render_template, session
from flask_cors import CORS
import os
import threading
import docker

# Импорт Blueprints
import sys
import os
# Добавляем текущую директорию в путь для импорта модулей
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from routes import auth, commands, banlist, terminal, players, resources

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

# Используем локальную блокировку для потокобезопасности RCON
lock = threading.Lock()

# Инициализация Docker клиента
try:
    docker_client = docker.from_env()
except:
    docker_client = None

# Регистрация Blueprints
app.register_blueprint(auth.auth_bp)

# Инициализация и регистрация blueprints, которые требуют lock или docker_client
commands.init_commands_bp(lock)
app.register_blueprint(commands.commands_bp)

banlist.init_banlist_bp(lock)
app.register_blueprint(banlist.banlist_bp)

terminal.init_terminal_bp(docker_client)
app.register_blueprint(terminal.terminal_bp)

players.init_players_bp(lock)
app.register_blueprint(players.players_bp)

resources.init_resources_bp(lock, docker_client)
app.register_blueprint(resources.resources_bp)


@app.route('/')
def index():
    """Главная страница приложения"""
    if 'logged_in' not in session or not session['logged_in']:
        return render_template('login.html')
    return render_template('index.html')


if __name__ == '__main__':
    # Включаем debug режим для автоматической перезагрузки при изменениях файлов
    # use_reloader=True перезагружает приложение при изменении файлов
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=True, use_debugger=True)
