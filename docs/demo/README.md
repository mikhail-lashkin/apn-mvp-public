/**
 * @file: docs/demo/README.md
 * @description: Demo case — screenshots, field test, roadmap (PG-13)
 * @created: 2026-08-09
 */

# Demo case

Кейс читается за 2–3 минуты: проблема → сценарий со скринами → полевая проверка → now vs next.

## Главный сценарий

1. Lobby — выбрать / создать стол  
2. Table — рассадка по местам  
3. ColorSystem — метка типа оппонента  
4. QuickNote — текст и/или быстрые теги → Save  
5. Sync — локальная очередь уходит на API, когда сеть есть  

Скриншоты (emulator UI baseline, 2026-07-18; синтетические demo-данные):

| Кадр | Файл |
|------|------|
| Lobby | [`screenshots/01-table-list.png`](screenshots/01-table-list.png) |
| Стол | [`screenshots/02-table-screen.png`](screenshots/02-table-screen.png) |
| Игрок на месте | [`screenshots/04-player-added.png`](screenshots/04-player-added.png) |
| Метка | [`screenshots/05-player-type.png`](screenshots/05-player-type.png) |
| QuickNote | [`screenshots/06-quick-note-open.png`](screenshots/06-quick-note-open.png) |
| После Save | [`screenshots/07-note-saved.png`](screenshots/07-note-saved.png) |

Короткое demo-video с S23 — опционально; если появится файл, кладите в `docs/demo/` и не коммитьте сырой logcat/field-debug ZIP.

## Полевой тест 2026-07-25

Приложение использовано за **реальным столом** (казино). Критического блокера эксплуатации не выявлено.

Подтвердилось:

- Speed Focus UI пригоден для live-темпа;
- заметки / метки / мобильный контур работают как рабочий инструмент;
- стек (mobile + API) годится для дальнейшего развития.

Требования с поля **не** вливались скрытым скоупом в alpha — вынесены в backlog:

| Тема | Суть |
|------|------|
| Гибкая конфигурация стола / 7-max | не хардкодить только 6/8 |
| Live Hand Capture | двухэтапный UX записи раздачи |
| Таймер отсутствия | mindset / break |
| Профили live-сайзингов | шпаргалка под площадку/лимит |

Физическое устройство (Samsung S23 Ultra) дополнительно закрывало release/smoke-контур (Maestro standalone, RC APK) — отдельно от полевой сессии за столом.

## Now vs Next

### Реализовано сейчас (public alpha)

- Mobile-only стол, Lobby, QuickNote, ColorSystem tags  
- Auth + CRUD notes/players/tables  
- Offline queue + sync к local API  
- Hybrid recommendation с default `ML_LLM_PROVIDER=off` (rule map; LLM опционально)

### Roadmap (гипотезы / Beta — не обещание релиза)

```text
стабилизация alpha
    → гибкая конфигурация стола
    → Live Hand Capture (design → MVP)
    → ML/NLP extension (evaluation set, не «магический AI»)
```

Дальние идеи (не в scope alpha): GTO-движок, Obsidian/TextExpander must-have, voice capture, production SaaS.
