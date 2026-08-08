/**
 * @file: CONTRIBUTING.md
 * @description: Краткие правила для внешних контрибьюторов
 * @created: 2026-08-09
 */

# Contributing

Спасибо за интерес к public alpha.

## Базовые правила

1. Не коммитьте секреты (`.env`, keystore, API keys).
2. Локальный мусор и временные APK — в `.git/info/exclude`, не раздувайте публичный `.gitignore` без нужды.
3. Product UI живёт только в `apps/mobile/`.
4. Backend-логика — в `src/backend/`; `backend/` — Alembic/Docker.
5. Перед PR: `npm run test` и по возможности `npm run e2e:smoke` на эмуляторе.

## Scope

Public alpha = live table notes + sync + optional hybrid recommendation.  
Крупные product pivots (новый web client, production SaaS) обсуждайте в issue до большого diff.

## Docs

- Architecture: `docs/architecture.md`
- Setup: `docs/setup.md`
- Testing: `docs/testing.md`
