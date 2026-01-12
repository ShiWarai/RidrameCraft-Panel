"""
Утилиты для проверки доступности BlueMap
"""
import socket
import os


def check_bluemap_available(bluemap_host='minecraft-server', bluemap_port=8100, timeout=1):
    """
    Проверить доступность BlueMap веб-сервера
    
    Args:
        bluemap_host: Хост BlueMap (имя контейнера в Docker сети)
        bluemap_port: Порт BlueMap веб-сервера (внутренний порт контейнера, обычно 8100)
        timeout: Таймаут подключения в секундах
    
    Returns:
        bool: True если BlueMap доступен, False иначе
    """
    try:
        # Пытаемся подключиться к порту BlueMap
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((bluemap_host, bluemap_port))
        sock.close()
        
        # Если result == 0, подключение успешно
        return result == 0
    except Exception as e:
        print(f"Ошибка при проверке доступности BlueMap: {e}")
        return False
