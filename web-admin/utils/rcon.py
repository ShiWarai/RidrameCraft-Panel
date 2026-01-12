"""
Утилиты для работы с RCON протоколом Minecraft сервера
"""
import socket
import struct
import re
import threading


def send_rcon_command(command, rcon_host, rcon_port, rcon_password, lock):
    """
    Отправить команду через RCON протокол
    
    Args:
        command: Команда для выполнения
        rcon_host: Хост RCON сервера
        rcon_port: Порт RCON сервера
        rcon_password: Пароль RCON
        lock: Блокировка для потокобезопасности
    
    Returns:
        dict: {'success': bool, 'response': str} или {'success': False, 'error': str}
    """
    try:
        with lock:
            # Создаем сокет
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((rcon_host, rcon_port))
            
            # Отправляем пакет аутентификации
            request_id = 1
            packet = struct.pack('<ii', request_id, 3)  # 3 = SERVERDATA_AUTH
            packet += rcon_password.encode('utf-8') + b'\x00\x00'
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


def parse_banlist_response(response_text):
    """
    Парсит ответ команды banlist и возвращает список забаненных игроков
    
    Args:
        response_text: Текст ответа от команды banlist
    
    Returns:
        list: Список имен забаненных игроков
    """
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
                player_name = re.sub(r'\x1b\[[0-9;]*m', '', player_name)
                if player_name and len(player_name) < 20:  # Имена игроков обычно короче
                    players.append(player_name)
            continue
        
        # Обрабатываем формат "player: reason" или "player: UUID"
        if ':' in line and 'was banned' not in line.lower():
            player_part = line.split(':', 1)[0].strip()
            # Убираем ANSI escape коды
            player_part = re.sub(r'\x1b\[[0-9;]*m', '', player_part)
            # Проверяем, что это похоже на имя игрока
            if player_part and len(player_part) < 20 and not any(phrase in player_part.lower() for phrase in ['banned', 'operator', 'reason', 'uuid', 'there are']):
                players.append(player_part)
            continue
        
        # Если строка похожа на имя игрока (просто имя без дополнительной информации)
        if not any(phrase in line.lower() for phrase in ['banned', 'operator', 'reason', 'uuid', 'there are', 'was banned']):
            # Убираем ANSI escape коды
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
    """
    Парсит ответ команды whitelist list и возвращает список игроков в whitelist
    
    Args:
        response_text: Текст ответа от команды whitelist list
    
    Returns:
        list: Список имен игроков в whitelist
    """
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
