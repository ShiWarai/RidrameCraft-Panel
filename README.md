# Minecraft Server Docker Setup

Docker-конфигурация для запуска Minecraft сервера (Vanilla, Forge, CurseForge модпаки) с веб-панелью управления, BlueMap и веб-консолью.

## Требования

- Docker 20.10+ и Docker Compose 2.0+
- Минимум 2GB RAM (4GB+ для модпаков)
- 10GB+ свободного места на диске

## Быстрый старт

1. **Настройте переменные окружения:**
   ```bash
   cp env.modpack.example modpack.env
   # Отредактируйте modpack.env при необходимости
   ```

2. **Запустите сервер:**
   ```bash
   docker compose --env-file modpack.env up -d
   ```

3. **Проверьте логи:**
   ```bash
   docker compose logs -f
   ```

## Настройка

### Переменные окружения

**Основные переменные:**
- `TYPE` - тип сервера (`CURSEFORGE`, `FORGE` или пусто для Vanilla)
- `MINECRAFT_VERSION` - версия Minecraft (для Vanilla)
- `FORGE_VERSION` - версия Forge (например: `1.20.1-47.4.13`)
- `MEMORY` - размер памяти JVM (2G для Vanilla, 4G-8G для модпаков)
- `CF_SERVER_MOD` - путь к архиву серверного пакета CurseForge
- `MODPACK_PATH` - путь к модпаку в папке `modpacks/` (автокопирование)
- `SERVER_DATA_DIR` - имя папки данных сервера (по умолчанию: `vanilla`)
- `RCON_PASSWORD` - пароль для RCON
- `ADMIN_PASSWORD` - пароль для веб-панели
- `USE_SPARK_MEMORY` - использовать данные Spark для памяти (true/false)

**Примеры конфигураций:**
- `env.vanilla.example` - для ванильного сервера
- `env.modpack.example` - для модпака из CurseForge

### Установка модпака

**Автоматическое копирование (рекомендуется):**
1. Поместите модпак в папку `modpacks/`
2. Настройте `.env`:
   ```env
   TYPE=FORGE
   FORGE_VERSION=1.20.1-47.4.13
   MODPACK_PATH=modpacks/your-modpack
   SERVER_DATA_DIR=modpack-name
   MEMORY=8G
   ```
3. Запустите: `docker compose --env-file modpack.env up -d`

**CurseForge Server Pack:**
1. Скачайте Server Pack с CurseForge
2. Поместите в `modpacks/`
3. Настройте `.env`:
   ```env
   TYPE=CURSEFORGE
   CF_SERVER_MOD=/data/modpacks/server-pack.zip
   MEMORY=4G
   ```

## Управление сервером

```bash
# Запуск
docker compose --env-file modpack.env up -d

# Остановка
docker compose down

# Просмотр логов
docker compose logs -f

# Перезапуск
docker compose restart
```

## Структура проекта

```
minecraft-console/
├── data/${SERVER_DATA_DIR}/  # Данные сервера (world, logs, config)
├── modpacks/                 # Модпаки для автокопирования
├── web-admin/               # Веб-панель управления (Flask)
│   ├── routes/              # Flask Blueprints
│   ├── utils/               # Утилиты (RCON, Docker, Mojang API)
│   ├── static/              # CSS, JS модули
│   └── templates/           # HTML шаблоны
├── docker-compose.yml       # Конфигурация Docker Compose
└── env.*.example            # Примеры конфигураций
```

## Веб-панель управления

**Доступ:** `http://localhost:5000`

**Режимы доступа:**
- **Администратор** - полный доступ (команды, логи, управление игроками, банлист/whitelist)
- **Гость** - просмотр статистики, игроков онлайн, карты

**Возможности:**
- Мониторинг ресурсов (CPU, RAM, TPS, MSPT) с интеграцией Spark
- Управление игроками (кик, бан, OP, смена режима игры)
- Выполнение команд через RCON с историей
- Просмотр логов сервера с автообновлением
- Управление пользовательскими командами
- Управление банлистом и белым списком
- Интеграция с BlueMap для просмотра карты

**Настройка пароля:** `ADMIN_PASSWORD` в `.env`

## BlueMap - 3D карта

**Доступ:** `http://localhost:25589` или через веб-панель

**Конфигурация:** `./data/${SERVER_DATA_DIR}/config/bluemap/`

- `core.conf` - основные настройки
- `webapp.conf` - настройки веб-приложения (язык, тема)
- `maps/` - конфигурация миров

**Перезагрузка:** `docker exec minecraft-server rcon-cli bluemap reload`

## Порты

- **25565** - игровой порт Minecraft
- **25575** - RCON (только внутри Docker сети)
- **25588** - Spark (только внутри Docker сети)
- **25589** - BlueMap веб-интерфейс
- **25590** - Веб-консоль ttyd
- **5000** - Веб-панель управления

## Обновление

```bash
# Обновление Minecraft сервера
docker compose down
docker compose pull minecraft-server
docker compose up -d

# Пересборка веб-панели
docker compose build web-admin
docker compose up -d web-admin
```

## Решение проблем

**Сервер не запускается:**
- Проверьте логи: `docker compose logs minecraft-server`
- Убедитесь, что `server.properties` существует в `./data/${SERVER_DATA_DIR}/`
- Для модпаков проверьте `TYPE` и `FORGE_VERSION`

**Веб-панель не работает:**
- Проверьте логи: `docker compose logs web-admin`
- Убедитесь, что RCON включен (`ENABLE_RCON=true`)
- Проверьте совпадение `RCON_PASSWORD` в обоих контейнерах

**Недостаточно памяти:**
- Увеличьте `MEMORY` в `.env` (4GB+ для модпаков)

## Безопасность

- Используйте надежные пароли (`RCON_PASSWORD`, `ADMIN_PASSWORD`)
- Настройте файрвол для ограничения доступа к портам
- Для production используйте HTTPS через reverse proxy (nginx)
- BlueMap и веб-консоль доступны без аутентификации - ограничьте доступ

## Лицензия

Использование сервера подчиняется [EULA Minecraft](https://account.mojang.com/documents/minecraft_eula).
