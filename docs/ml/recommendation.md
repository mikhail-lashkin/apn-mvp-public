/**
 * @file: docs/ml/recommendation.md
 * @description: Hybrid recommendation (public alpha)
 * @created: 2026-08-09
 */

# Recommendations (hybrid)

Hybrid recommendation для live-стола: **ColorSystem rule baseline** + опциональный **structured LLM** extraction.

По умолчанию внешние вызовы **выключены** (`ML_LLM_PROVIDER=off`).

## Flow

```text
QuickNote → POST /players/{id}/recommendation → FastAPI
                                              ├─ ColorSystem map (always)
                                              └─ LlmClient (optional)
```

Ключи API только на сервере. Mobile ключей не хранит.

## Env

| Variable | Meaning |
|----------|---------|
| `ML_LLM_PROVIDER` | `off` (default) \| `opencode_go` \| `deepseek` |
| `OPENCODE_API_KEY` / `DEEPSEEK_API_KEY` | только если provider ≠ `off` |

При `off`, отсутствии ключа, ошибке LLM или пустых нотсах → **rule map**.

## Limitations

- Это не classical ML classifier с published F1.
- Нотсы при LLM-режиме уходят к выбранному провайдеру — не кладите ПДн в текст заметок на demo.
- Cache in-memory (TTL), не гарантия production SLA.

## Тесты

```bash
py -3.11 -m pytest src/backend/tests/test_recommendation.py -q
cd apps/mobile && npx jest --testPathPatterns=colorLineMap
```
