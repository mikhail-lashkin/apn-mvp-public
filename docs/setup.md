/**
 * @file: docs/setup.md
 * @description: Local setup для public alpha
 * @created: 2026-08-09
 */

# Setup

## Требования

- Node.js 18+ (npm)
- Python 3.11+ (venv)
- Docker Desktop
- Android Studio / emulator (для native smoke)

## Установка

```bash
cp .env.example .env
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
npm run install:all
```

## Backend

```bash
npm run docker:up
# http://localhost:8000/health
# http://localhost:8000/docs
```

Миграции применяются при старте контейнера (`alembic upgrade head`).

Локально без Docker (если Postgres уже есть):

```bash
uvicorn src.backend.main:app --reload --port 8000
```

## Mobile

```bash
npm run dev
# Windows + эмулятор:
npm run dev:android
```

API по умолчанию: `http://127.0.0.1:8000`. Переопределение:

```bat
set EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

На Android emulator часто удобен `adb reverse tcp:8000 tcp:8000` (делает `dev-android.ps1`).

## Release APK (опционально)

```bash
npm run build:release:apk
```

Положите keystore в `apps/mobile/credentials/` (не коммитится). Без credentials скрипт подскажет создать `keystore.properties` из example, если он есть локально.

## ML (опционально)

В `.env` / окружении контейнера:

```env
ML_LLM_PROVIDER=off
# OPENCODE_API_KEY=
# DEEPSEEK_API_KEY=
```

См. [`ml/recommendation.md`](ml/recommendation.md).
