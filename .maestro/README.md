# Maestro E2E — AI Poker Notes (Android)

Regression pack для dev-client APK `com.aipoker.notes` на Android-эмуляторе.

## Предусловия

1. Эмулятор запущен (`adb devices` → любой `emulator-*`; или задать `APN_ADB_SERIAL`)
2. Установлен dev-client APK (`adb shell pm path com.aipoker.notes`)
3. Backend на `:8000` + `adb reverse tcp:8000 tcp:8000`
4. Metro dev-client на `:8081` + `adb reverse tcp:8081 tcp:8081`  
   `cd apps/mobile && npm run start:dev-client`
5. Maestro CLI: `C:\Tools\maestro\maestro\bin\maestro.bat`
6. Логин smoke: `test@test.com` / `test123456`

## Команды

```powershell
# из корня репо
npm run e2e:smoke          # один smoke flow (Metro + APK уже должны быть)
npm run e2e:sc1            # SC-1: 8-max смешанная посадка
npm run e2e:sc1:new        # SC-1: чистый 8-max + empty slots
npm run e2e:sc3:s23        # SC-3: быстрые теги на USB/S23 (release APK)
npm run e2e:sc4            # SC-4: RU+EN notes, полная посадка, смена, offline
npm run e2e:sc4:s23        # SC-4 на USB/S23 (release APK)
npm run e2e                # все flows в .maestro/
npm run dev:android:smoke    # полный цикл: build APK + Metro + Maestro smoke.yaml
.\scripts\dev-android.bat smoke   # то же через меню: пункт 10
.\scripts\maestro-test.ps1 .maestro\player-note.yaml   # один flow
```

## P0 regression pack (канон)

| Flow | Проверяет |
|------|-----------|
| `smoke.yaml` | Login → стол → tap seat, нет crash |
| `smoke-sc1.yaml` | SC-1: пресет Сочи 8-max — 8 мест, пустые/занятые, QuickNote |
| `smoke-sc1-new-table.yaml` | SC-1: чистый 8-max (HERO + 7 empty), диалог пустого слота |
| `smoke-sc3-standalone.yaml` | SC-3 на USB/S23: группы тегов + лимп → Save → reopen |
| `smoke-sc4.yaml` | SC-4: 8-max full sit → RU/EN notes → replace seat → offline |
| `smoke-sc4-standalone.yaml` | SC-4 на USB/S23 (release APK) |
| `smoke-sc6.yaml` | SC-6: лобби «Метки» → add custom tag → назад |
| `smoke-sc6-tagmodal.yaml` | SC-6: long-press seat → ColorSystem TagModal → fish |
| `smoke-table-crud.yaml` | Create table → seat → tag → note → delete |
| `smoke-sc7.yaml` | SC-7: лобби «Теги» → add custom note tag |
| `player-note.yaml` | RU+EN заметка + тег лимп → Save → reopen |
| `autosave.yaml` | Save-on-close без кнопки Save |
| `restart-persistence.yaml` | stopApp → launchApp → данные на месте |
| `android-back.yaml` | Back в QuickNote / NewPlayer / TagModal |
| `fast-player-switch.yaml` | Черновик игрока A после переключения на B |

Каждый flow **самодостаточен**: `prepare-table` → reset локальных данных → seed.

## Legacy (дополнительно)

| Flow | Назначение |
|------|------------|
| `smoke-login-seat.yaml` | Полный login → Ivan → note |
| `smoke-from-lobby.yaml` | Smoke от лобби |
| `smoke-offline-ivan-notes.yaml` | Offline Ivan + Petr, sync |

## Subflows (`subflows/`)

| Файл | Назначение |
|------|------------|
| `launch-dev-client.yaml` | launchApp + optional Metro link |
| `login.yaml` | test@test.com login |
| `open-table.yaml` | lobby → стол (legacy) |
| `prepare-table.yaml` | launch + login + open + reset |
| `prepare-table-sc1.yaml` | launch + login → стол `sc1` (8-max) |
| `prepare-new-table.yaml` | launch + login → «+ Новый стол» → SetupSheet Save |
| `reset-app.yaml` | Сброс локальных данных стола |
| `seed-test-data.yaml` | Посадить игрока (`SEAT`, `PLAYER_NAME`) |
| `open-player.yaml` | Открыть QuickNote (`SEAT`) |
| `add-tag-fish.yaml` | Тег заметки «лимп» (SC-3 toggle, `note-tag-лимп`) |
| `write-and-save-note.yaml` | Текст + тег лимп + Save (`NOTE_TEXT`, ASCII) |
| `write-and-save-note-ru.yaml` | RU через copy/paste с чипа «лимп» + Save |
| `replace-seat-new-player.yaml` | Long-press → «Заменить — новый» (`SEAT`, `PLAYER_NAME`) |
| `sc4-core.yaml` | Ядро SC-4: посадка / RU+EN / replace / offline |
| `seat-ivan-note.yaml` | Legacy Ivan + note |

## Контракт testID

| Префикс | Примеры |
|---------|---------|
| Стол | `seat-empty-0`, `seat-player-0`, `reset-table-local` |
| Auth | `login-email`, `login-password`, `login-submit`, `lobby-new-table` |
| QuickNote | `quick-note-text`, `quick-note-save`, `close-player-profile` |
| Игрок | `new-player-name`, `new-player-create`, `new-player-cancel` |
| Теги заметки | `note-tag-лимп`, `note-tag-*` (группы Preflop/Postflop/…) |
| Теги игрока | `player-tag-add`, `player-tag-fish`, `player-seat-tag-fish` |
| Picker | `player-picker-toggle`, `player-picker-item-{id}` |

Правило: новые критичные элементы — `testID` + `accessibilityLabel`, без координат.

## Расширение и поддержка

### Добавить новый flow

1. Одна гипотеза на flow («данные не теряются при X»).
2. Начать с `runFlow: subflows/prepare-table.yaml`.
3. Уникальные данные: `evalScript: ${output.ts = Date.now()}`.
4. Повтор — в subflow, не копипаста.
5. Записать flow в таблицу выше + `docs/testing.md`.
6. Прогнать `npm run e2e:smoke` минимум; полный pack перед релизом.

### Теги Maestro

Flows помечены `p0`, `smoke`, `save-on-close`. Подмножества:

```powershell
maestro test --include-tags p0 .maestro
```

### UI baseline (FG-6, не P0)

| Flow | Назначение |
|------|------------|
| `smoke-ui-baseline.yaml` | Скриншоты `00`…`10` → `artifacts/ui-baseline/` |

```powershell
npm run e2e:ui-baseline
```

Tag `ui-baseline` исключён из `npm run e2e` (см. `.maestro/config.yaml`). Отчёт: `docs/design/fg6-ui-baseline.md`.

### Планируемые расширения (не в P0)

- `offline-api-errors.yaml` — после Debug Network Mode
- `debounced-autosave.yaml` — после debounce в QuickNote
- CI nightly на эмуляторе

### DoD для UI-PR

Если меняли QuickNote / seats / login → локально `npm run e2e:smoke` PASS.

## Troubleshooting

| Симптом | Действие |
|---------|----------|
| Metro launcher | `adb reverse tcp:8081` → tap **`http://localhost:8081`** (Windows); fallback `10.0.2.2:8081` |
| Login timeout | Backend `/health`, `adb reverse` |
| Flow flaky | Логи: `%USERPROFILE%\.maestro\tests\` |
| APK missing | Сборка см. `docs/testing.md` → Maestro UI E2E |

## Cursor: `/maestro-e2e` и `@maestro-apk-e2e`

Slash-команда **`/maestro-e2e`** в Cursor просит агента **сразу прогнать** UI E2E на эмуляторе (реальные shell-команды, не unit-тесты).

| Триггер | Где | Назначение |
|---------|-----|------------|
| `/maestro-e2e` | Cursor chat | Выполнить playbook ниже |
| `@maestro-apk-e2e` | Cursor chat / rule | То же + детали в `.cursor/rules/maestro-apk-e2e.mdc` |

Источники playbook: [`.cursor/commands/maestro-e2e.md`](../.cursor/commands/maestro-e2e.md), [`.cursor/rules/maestro-apk-e2e.mdc`](../.cursor/rules/maestro-apk-e2e.mdc), [`docs/testing.md`](../docs/testing.md).

### Что делает агент (по порядку)

1. **Эмулятор** — `adb devices`; нет device → стоп, попросить включить AVD.
2. **Backend** — `:8000/health`; при необходимости `docker compose up -d` из корня.
3. **APK** — `com.aipoker.notes` установлен; иначе сборка (`GRADLE_USER_HOME=C:\g`, `x86_64`, см. `docs/testing.md`).
4. **Metro** — `cd apps/mobile && npm run start:dev-client`; `adb reverse` 8000 и 8081.
5. **Dev-client** — deep link / tap **`localhost:8081`** (через `adb reverse`), дождаться «AI Poker Notes» в UI.
6. **Maestro** — по умолчанию P0 smoke:
   ```powershell
   npm run e2e:smoke
   # или
   .\scripts\maestro-test.ps1 .maestro\smoke.yaml
   ```
7. **Отчёт** — `PASS` / `FAIL`, упавший шаг, при FAIL — `%USERPROFILE%\.maestro\tests\…`

### Варианты прогона (можно указать агенту явно)

| Задача | Команда |
|--------|---------|
| Быстрый smoke (default для `/maestro-e2e`) | `npm run e2e:smoke` |
| Полный цикл с нуля (build + Metro + smoke) | `npm run dev:android:smoke` |
| Все 9 flows | `npm run e2e` |
| Только P0 по тегам | `maestro test --include-tags p0 .maestro` |
| Legacy: Ivan + note | `.\scripts\maestro-test.ps1 .maestro\smoke-login-seat.yaml` |
| Offline sync | `.\scripts\maestro-test.ps1 .maestro\smoke-offline-ivan-notes.yaml` |
| SC-4 notes RU+EN | `npm run e2e:sc4` / `npm run e2e:sc4:s23` |
| UI baseline PNG (FG-6) | `npm run e2e:ui-baseline` |

### Чего агент не делает

- Не подменяет Maestro unit-тестами Jest.
- Не использует Expo Go (`host.exp.exponent`).
- Не коммитит и не пушит без запроса.
