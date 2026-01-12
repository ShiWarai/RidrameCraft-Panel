FROM python:3.11-slim

WORKDIR /app

# Копируем файл зависимостей
COPY requirements.txt .

# Установка зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Файлы будут монтироваться через volumes в docker-compose.yml
# Создаем только необходимые директории
RUN mkdir -p /app/templates /app/static

EXPOSE 5000

CMD ["python", "app.py"]

