# AI Poker Notes — Mobile

Единственный продуктовый UI: Expo 54 / React Native 0.81 / Expo Router / Zustand.

Стол live-покера, ColorSystem-метки, QuickNote, офлайн-sync, ML-1 рекомендации в QuickNote.

> Канон запуска и infra — из **корня** репо, не копировать сюда длинные гайды.

## Быстрый старт (из корня)

```bash
npm run install:all
npm run docker:up          # API :8000
npm run dev                # Metro (apps/mobile)
npm run dev:android        # эмулятор + меню (Windows)
```

Из этой папки:

```bash
npm start                  # expo start
npm run start:dev-client   # dev-client + --localhost
npm run android:clear      # Android + clear cache
npm test                   # Jest
```

Подробно: [`docs/setup.md`](../../docs/setup.md) · [`scripts/README.md`](../../scripts/README.md) · корневой [`README.md`](../../README.md)

## Структура

```
app/                 # Expo Router screens
  (public)/          # login, onboarding
  (app)/             # lobby, table/[id], detail-note
components/          # стол, QuickNote, sheets, tags
stores/              # Zustand (auth, table, …)
services/
  api/               # HTTP clients (в т.ч. recommendationApi.ts)
  sync/              # SyncService
  aiApi.ts           # legacy mock — НЕ продуктовый путь
constants/           # colorLineMap и др.
__tests__/           # Jest
```

## AI / рекомендации

Продуктовый путь: `services/api/recommendationApi.ts` → `POST /players/{id}/recommendation`.  
Офлайн: `constants/colorLineMap.ts` (зеркало ColorSystem).  
Legacy: `services/aiApi.ts` — не использовать в новых фичах.

Docs: [`docs/ml/ml1-recommendation.md`](../../docs/ml/ml1-recommendation.md)

## Метки игроков

**ColorSystem** (hex/slug из seed), не legacy enum TAG/LAG/NIT.  
См. backend `color_system` + mobile tag seed / poker rules.

## Тесты и E2E

```bash
npm test
# из корня:
npm run e2e:smoke
# ML-1 Maestro: .maestro/smoke-ml1.yaml
```

Справка: [`docs/testing.md`](../../docs/testing.md) · [`.maestro/README.md`](../../.maestro/README.md)

## Заметки по Windows / эмулятору

- Предпочтительно `npm run dev:android` из корня (AVD, `adb reverse`, меню).
- Metro для эмулятора: флаги `--localhost` (LAN часто ломается на Hyper-V/VirtualBox).
- Release APK / USB Maestro: корневые скрипты (`build:release:apk`, пункты меню 12–14).

## Документация

| Тема | Файл |
|------|------|
| Архитектура | [`docs/architecture.md`](../../docs/architecture.md) |
| Setup | [`docs/setup.md`](../../docs/setup.md) |
| Корневой README | [`README.md`](../../README.md) |
