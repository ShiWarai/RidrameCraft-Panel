"""
Blueprint для авторизации
"""
from flask import Blueprint, request, jsonify, session
from functools import wraps
import os

auth_bp = Blueprint('auth', __name__)

ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')


def login_required(role='guest'):
    """
    Декоратор для проверки авторизации и роли пользователя
    
    Args:
        role: Минимальная требуемая роль ('guest' или 'admin')
    """
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


@auth_bp.route('/api/login', methods=['POST'])
def login():
    """Авторизация пользователя"""
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


@auth_bp.route('/api/logout', methods=['POST'])
def logout():
    """Выход из системы"""
    session.pop('logged_in', None)
    return jsonify({'success': True})
