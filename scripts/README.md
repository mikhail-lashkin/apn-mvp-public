# Scripts — local mobile / Docker / Maestro

Точка входа (Windows): `dev-android.bat` → `dev-android.ps1`.

## Быстрый старт

```bat
scripts\dev-android.bat
```

Типичный цикл public alpha:

1. `npm run docker:up` — Postgres + FastAPI на `:8000`
2. `scripts\dev-android.bat` → пункт **1** или **2** (эмулятор + Metro)
3. Пункт **10** — Maestro smoke на эмуляторе (local API)

## API target

По умолчанию **local** → `http://127.0.0.1:8000` + `adb reverse`.

Опционально remote: создайте `scripts/api-target.env` (файл в `.gitignore` / local exclude):

```env
API_TARGET=server
SERVER_API_URL=http://127.0.0.1:8000
```

Private deploy-контуры в этот репозиторий не входят.

## Release APK

```bat
npm run build:release:apk
npm run build:release:apk -- -ApiUrl http://127.0.0.1:8000
```

Нужен локальный keystore в `apps/mobile/credentials/` (не коммитится). См. `docs/setup.md`.

## Maestro

```bat
npm run e2e:smoke
```

Подробнее: `docs/testing.md`.
