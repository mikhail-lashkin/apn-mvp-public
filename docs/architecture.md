/**
 * @file: docs/architecture.md
 * @description: Публичная архитектура APN-MVP alpha
 * @created: 2026-08-09
 */

# Architecture

## Слои

### Presentation — `apps/mobile/`

- Expo Router экраны: login/onboarding, lobby, table, detail note
- Zustand stores (`table`, auth, sync-related)
- Speed Focus UI: стол, QuickNote, TagModal
- Локальное хранение + очередь sync

### Application — `src/backend/`

FastAPI routers: auth, notes, players, tables, sessions, sync.  
Точка входа: `src.backend.main:app`.

Миграции и Dockerfiles — в `backend/` (Alembic).

### Data

- PostgreSQL 14 (Docker Compose)
- Mobile: AsyncStorage / локальный кэш до успешного sync

### ML (optional)

`POST /players/{id}/recommendation`:

1. ColorSystem rule map (cold-start / offline / `ML_LLM_PROVIDER=off`)
2. Опционально structured LLM extraction (keys только на сервере)

Это **не** классический NLP-классификатор с бенчмарком — честный hybrid / LLM Engineering слой.

## Data flow

```text
User → Mobile UI → Store → local write
                         ↓ (online)
                    SyncService → FastAPI → PostgreSQL
                         ↓
              recommendation (rule ± LLM)
```

## Trade-offs

1. **Mobile-only** — один клиент, меньше поверхности поддержки.
2. **Offline-first** — UX за столом важнее мгновенной консистентности с сервером.
3. **Local-first demo** — public alpha не требует private cloud; self-host через Compose.
4. **Cleartext HTTP в local/dev** — упрощает emulator/`adb reverse`; HTTPS — hardening для публичной раздачи.

## Границы alpha

Не входят в обязательный runtime: private deploy tooling, agent bootstrap files, field diagnostics, production secrets.
