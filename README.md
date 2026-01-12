# RidrameCraft Panel

Веб-панель для управления Minecraft сервером. Поддержка Vanilla, Forge и CurseForge модпаков с автоматической установкой, интеграцией BlueMap и мониторингом производительности.

Создавался для небольшого Minecraft сервера, поэтому на больших нагрузках не тестировал.

Дисклеймер: в рамках проекта применён искусственный интеллект.

## Возможности

### Веб-панель управления
- **Мониторинг в реальном времени**: CPU, RAM, TPS, MSPT с интеграцией Spark
- **Управление игроками**: кик, бан, OP, смена режима игры с аватарами из Mojang API
- **Консоль сервера**: выполнение команд через RCON с историей и автодополнением
- **Просмотр логов**: автоматическое обновление логов сервера с подсветкой синтаксиса
- **Пользовательские команды**: создание быстрых команд с кастомными названиями
- **Банлист и Whitelist**: управление через удобный интерфейс
- **3D карта**: интеграция с BlueMap для просмотра мира в браузере

### Простота использования
- **Один команда запуска**: `docker compose --env-file modpack.env up -d`
- **Автоматическая установка модпаков**: просто поместите модпак в папку `modpacks/`
- **Готовые конфигурации**: примеры для Vanilla и модпаков из коробки
- **Автоматическое принятие EULA**: без ручной настройки

### Безопасность
- **Два режима доступа**: администратор и гость
- **Защита паролем**: настраиваемый пароль для веб-панели
- **Изолированная сеть**: RCON доступен только внутри Docker сети

## Требования

- Docker 20.10+ и Docker Compose 2.0+
- Минимум 2GB RAM (4GB+ для модпаков)
- 10GB+ свободного места на диске

## Быстрый старт

```bash
# 1. Клонируйте репозиторий
git clone <repository-url>
cd RidrameCraft-Panel

# 2. Настройте переменные окружения
cp env.modpack.example modpack.env
# Отредактируйте modpack.env при необходимости

# 3. Запустите сервер
docker compose --env-file modpack.env up -d

# 4. Откройте веб-панель
# http://localhost:5000
```

## Документация

### Настройка переменных окружения

**Основные переменные:**
- `TYPE` - тип сервера (`CURSEFORGE`, `FORGE` или пусто для Vanilla)
- `MINECRAFT_VERSION` - версия Minecraft (для Vanilla)
- `FORGE_VERSION` - версия Forge (например: `1.20.1-47.4.13`)
- `MEMORY` - размер памяти JVM (2G для Vanilla, 4G-8G для модпаков)
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
```bash
# 1. Поместите модпак в папку modpacks/
mkdir -p modpacks
cp -r /path/to/your-modpack ./modpacks/

# 2. Настройте modpack.env
TYPE=FORGE
FORGE_VERSION=1.20.1-47.4.13
MODPACK_PATH=modpacks/your-modpack
SERVER_DATA_DIR=modpack-name
MEMORY=8G

# 3. Запустите
docker compose --env-file modpack.env up -d
```

**CurseForge Server Pack:**
```bash
# 1. Скачайте Server Pack с CurseForge и поместите в modpacks/
cp server-pack.zip ./modpacks/

# 2. Настройте modpack.env
TYPE=CURSEFORGE
CF_SERVER_MOD=/data/modpacks/server-pack.zip
MEMORY=4G

# 3. Запустите
docker compose --env-file modpack.env up -d
```

### Управление сервером

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
RidrameCraft-Panel/
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

### Режимы доступа

- **Администратор** - полный доступ ко всем функциям:
  - Выполнение команд через RCON
  - Просмотр и управление логами
  - Управление игроками (кик, бан, OP)
  - Управление банлистом и белым списком
  - Создание пользовательских команд

- **Гость** - ограниченный доступ:
  - Просмотр статистики сервера (CPU, RAM, TPS, MSPT)
  - Просмотр списка игроков онлайн
  - Просмотр карты сервера (BlueMap)

### Настройка пароля

Пароль настраивается через переменную `ADMIN_PASSWORD` в файле конфигурации:

```env
ADMIN_PASSWORD=ваш_безопасный_пароль
```

## BlueMap - 3D карта

**Доступ:** `http://localhost:25589` или через веб-панель

Интерактивная 3D карта мира Minecraft с поддержкой нескольких измерений.

### Установка и настройка

1. **Установите мод BlueMap:**
   - Скачайте BlueMap для вашей версии Minecraft/Forge с [GitHub](https://github.com/BlueMap-Minecraft/BlueMap/releases)
   - Поместите файл `.jar` в папку `./data/${SERVER_DATA_DIR}/mods/`
   - Перезапустите сервер

2. **Настройте доступ из веба:**
   
   Убедитесь, что в `./data/${SERVER_DATA_DIR}/config/bluemap/webserver.conf` включен веб-сервер:
   ```yaml
   enabled: true  # Включить встроенный веб-сервер
   port: 8100     # Порт веб-сервера (по умолчанию)
   ```
   
   Остальные параметры BlueMap обычно настроены по умолчанию и не требуют изменений.

3. **Примените изменения:**
   ```bash
   docker exec minecraft-server rcon-cli bluemap reload
   ```

4. **Проверьте доступность:**
   - Откройте `http://localhost:25589` в браузере
   - Или используйте вкладку "Карта" в веб-панели

**Примечание:** При первом запуске BlueMap начнет рендерить карту. Это может занять некоторое время в зависимости от размера мира.

## Spark - Мониторинг производительности

Spark предоставляет детальную информацию о производительности сервера: TPS (Ticks Per Second), MSPT (Milliseconds Per Tick), использование CPU и памяти.

### Установка и настройка

1. **Установите мод Spark:**
   - Скачайте Spark для вашей версии Minecraft/Forge с [GitHub](https://github.com/lucko/spark/releases)
   - Поместите файл `.jar` в папку `./data/${SERVER_DATA_DIR}/mods/`
   - Перезапустите сервер

2. **Настройте конфигурацию Spark:**
   
   Отредактируйте файл `./data/${SERVER_DATA_DIR}/config/spark/config.json`:
   ```json
   {
     "backgroundProfiler": true
   }
   ```
   
   Включение `backgroundProfiler` необходимо для работы мониторинга в веб-панели.

3. **Включите использование Spark в веб-панели:**
   
   Добавьте в файл конфигурации (например, `modpack.env`):
   ```env
   USE_SPARK_MEMORY=true
   ```

4. **Перезапустите сервер и веб-панель:**
   ```bash
   docker compose restart minecraft-server
   docker compose restart web-admin
   ```

5. **Проверьте работу:**
   - Откройте веб-панель и перейдите в раздел "Ресурсы"
   - Если Spark установлен и настроен правильно, вы увидите секцию с данными TPS и MSPT
   - Данные Spark будут использоваться для отображения CPU и памяти (если `USE_SPARK_MEMORY=true`)

**Примечание:** 
- Если Spark не установлен или не настроен, веб-панель будет использовать данные Docker Stats для мониторинга
- Spark требует JVM аргумент `--enable-native-access=spark`, который уже настроен в `docker-compose.yml`
- Данные Spark обновляются каждые 5 секунд через команду `/spark healthreport`

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

## Безопасность

- Используйте надежные пароли (`RCON_PASSWORD`, `ADMIN_PASSWORD`)
- Настройте файрвол для ограничения доступа к портам
- Для production используйте HTTPS через reverse proxy (nginx)
- BlueMap и веб-консоль доступны без аутентификации - ограничьте доступ

## Лицензия

Использование сервера подчиняется [EULA Minecraft](https://account.mojang.com/documents/minecraft_eula).
