# Alembic Migrations - Инструкция по использованию

## Описание

Alembic настроен для управления миграциями базы данных PostgreSQL. Все миграции находятся в папке `alembic/versions/`.

## Начальная миграция

Создана начальная миграция `001_initial_migration_create_all_tables.py`, которая создает все таблицы:
- `users` - пользователи
- `notes` - заметки
- `player_profiles` - профили игроков
- `templates` - шаблоны заметок
- `board_analyses` - анализы раздач
- `tables` - покерные столы
- `sessions` - покерные сессии

## Использование

### Применение миграций

```bash
# Из корня проекта
cd backend
alembic upgrade head

# Или через Python скрипт
python scripts/migrate.py upgrade head
```

### Откат миграций

```bash
# Откат на одну миграцию назад
alembic downgrade -1

# Откат на конкретную ревизию
alembic downgrade <revision_id>

# Откат всех миграций
alembic downgrade base
```

### Создание новой миграции

```bash
# Автоматическое создание миграции на основе изменений моделей
alembic revision --autogenerate -m "Описание изменений"

# Создание пустой миграции (для ручных изменений)
alembic revision -m "Описание изменений"
```

### Просмотр истории миграций

```bash
# Текущая версия БД
alembic current

# История миграций
alembic history

# Детальная информация о миграции
alembic history -v
```

## Конфигурация

- `alembic.ini` - основной конфигурационный файл
- `alembic/env.py` - настройка окружения для миграций
- URL базы данных берется из переменной окружения `DATABASE_URL` или из `src.backend.db.session.SQLALCHEMY_DATABASE_URL`

## Переменные окружения

```bash
# Пример .env файла
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aipoker
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=aipoker
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

## Интеграция с Docker

Миграции можно запускать автоматически при старте контейнера:

```dockerfile
# В Dockerfile
RUN alembic upgrade head
```

Или через docker-compose:

```yaml
# В docker-compose.yml
command: sh -c "alembic upgrade head && uvicorn src.backend.main:app --host 0.0.0.0 --port 8000"
```

## Важные замечания

1. **Всегда делайте backup БД** перед применением миграций в production
2. **Тестируйте миграции** на staging окружении перед production
3. **Проверяйте downgrade функции** - они должны корректно откатывать изменения
4. **Не редактируйте примененные миграции** - создавайте новые вместо этого

## Структура миграции

Каждая миграция содержит:
- `revision` - уникальный идентификатор миграции
- `down_revision` - ссылка на предыдущую миграцию
- `upgrade()` - функция применения миграции
- `downgrade()` - функция отката миграции

## Troubleshooting

### Ошибка импорта моделей

Убедитесь, что путь в `alembic/env.py` правильно указывает на корень проекта:
```python
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
sys.path.insert(0, project_root)
```

### Ошибка подключения к БД

Проверьте:
1. PostgreSQL запущен
2. Переменные окружения установлены
3. URL БД в `alembic.ini` или `DATABASE_URL` корректный

### Конфликты миграций

Если возникли конфликты:
1. Проверьте текущую версию: `alembic current`
2. Синхронизируйте с БД: `alembic stamp head`
3. Создайте новую миграцию при необходимости
