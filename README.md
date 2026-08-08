/**
 * @file: README.md
 * @description: Публичный README APN-MVP public alpha
 * @created: 2026-08-09
 */

# AI Poker Notes (APN-MVP)

**Status:** `public alpha`  
**Стек:** Expo 54 / React Native · FastAPI · PostgreSQL · offline sync · hybrid recommendations

Мобильное приложение для live-покера: заметки по оппонентам за столом, цветовые метки (ColorSystem), офлайн-очередь синхронизации и опциональные hybrid-рекомендации (rule map + LLM).

**Продуктовый UI — только mobile** (`apps/mobile/`).

---

## Problem

За живым столом нужно быстро фиксировать наблюдения по игрокам и возвращаться к ним между раздачами — без тяжёлого desktop-workflow и без обязательного облака.

Public alpha показывает воспроизводимый контур:

1. local backend (Docker) + Expo mobile;
2. стол → рассадка → QuickNote / метки;
3. sync при появлении сети;
4. recommendation с `ML_LLM_PROVIDER=off` (без внешних ключей).

---

## Architecture

```text
Mobile (Expo / Zustand)
  ├─ UI: Lobby, Table, QuickNote, ColorSystem tags
  ├─ local persistence + offline queue
  └─ REST client ──► FastAPI (src/backend)
                         ├─ auth / notes / players / tables / sync
                         ├─ PostgreSQL
                         └─ ML: ColorSystem rule (+ optional LLM)
```

Ключевые trade-offs alpha:

| Решение | Почему |
|---------|--------|
| **Mobile-only** | Один продуктовый клиент; web shell не поддерживается |
| **Offline-first** | Заметки пишутся локально, sync — best effort |
| **Speed Focus UI** | Минимум тапов за столом (места, метки, quick note) |
| **Hybrid recommendation** | Rule baseline всегда доступен; LLM — опционально через env |

Подробнее: [`docs/architecture.md`](docs/architecture.md).

---

## Quick Start

Требования: Node 18+, Python 3.11+, Docker Desktop, Android emulator (опционально).

```bash
cp .env.example .env
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt

npm run install:all
npm run docker:up
# API: http://localhost:8000/health  ·  docs: http://localhost:8000/docs

npm run dev              # Expo Metro
# или Windows: npm run dev:android
```

Главный сценарий: логин → Lobby → стол → места/игроки → QuickNote → sync.

Setup: [`docs/setup.md`](docs/setup.md) · тесты: [`docs/testing.md`](docs/testing.md).

### Recommendations (optional)

По умолчанию `ML_LLM_PROVIDER=off` — только ColorSystem rule map.

```bat
set ML_LLM_PROVIDER=deepseek
set DEEPSEEK_API_KEY=...
```

См. [`docs/ml/recommendation.md`](docs/ml/recommendation.md).

---

## Structure

```text
apn-mvp-public/
├── apps/mobile/       # Expo / RN — единственный frontend
├── src/backend/       # FastAPI (бизнес-логика)
├── backend/           # Alembic + Dockerfiles
├── scripts/           # local Android / Maestro helpers
├── .maestro/          # E2E smoke flows
└── docs/              # architecture, setup, testing, ML
```

---

## Status / Limitations

В alpha:

- live table notes + ColorSystem tags;
- auth + CRUD + offline sync к **local** API;
- hybrid recommendation с default `off`.

Вне alpha / не обещаем как готовое:

- production cloud / managed hosting;
- классический ML-классификатор с published precision/recall;
- полный GTO-движок, Obsidian/TextExpander как must-have интеграции;
- hard purge / merge игроков и field-debug ops.

---

## License

MIT — см. [`LICENSE`](LICENSE).
