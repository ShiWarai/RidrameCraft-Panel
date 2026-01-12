"""
Утилиты для работы с Mojang API
"""
import requests


def get_player_uuid(username):
    """
    Получить UUID игрока через Mojang API
    
    Args:
        username: Имя игрока Minecraft
    
    Returns:
        str: UUID игрока с дефисами или None если не найден
    """
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


def get_player_avatar_url(uuid, size=40):
    """
    Получить URL аватарки игрока
    
    Args:
        uuid: UUID игрока
        size: Размер аватарки (по умолчанию 40)
    
    Returns:
        str: URL аватарки
    """
    if uuid:
        return f'https://mc-heads.net/avatar/{uuid}/{size}'
    return f'https://mc-heads.net/avatar/8667ba71-b85a-4004-af54-457fa973f346/{size}'  # Дефолтный аватар
