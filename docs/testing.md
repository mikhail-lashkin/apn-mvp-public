/**
 * @file: docs/testing.md
 * @description: Тесты public alpha
 * @created: 2026-08-09
 */

# Testing

## Unit / Jest (mobile)

```bash
npm run test
# или:
cd apps/mobile && npx jest
```

## Backend pytest

```bash
# в активированном venv, из корня репозитория
py -3.11 -m pytest src/backend/tests -q
```

Если каталог tests отсутствует в вашей копии — достаточно Jest + Maestro smoke для alpha-проверки UI.

## Maestro smoke (Android emulator)

Требования: установленный [Maestro](https://maestro.mobile.dev/), running emulator, local API (`npm run docker:up`).

```bash
npm run e2e:smoke
# или полный pack:
npm run e2e
```

Windows helper: `scripts/maestro-test.ps1`.

## Что не входит в public CI по умолчанию

- field-debug ZIP / bugreport с USB-устройств;
- device-specific packs на личных телефонах;
- зависимость от private remote API.
