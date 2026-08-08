/**
 * @file: errors.ts
 * @description: Парсинг ошибок FastAPI для mobile
 * @created: 2026-06-20
 */

import { ApiError } from './client';

export function formatApiDetail(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (typeof first?.msg === 'string') {
      return first.msg;
    }
  }
  return null;
}

export function mapNoteSaveError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const apiError = error as ApiError;
    if (apiError.status === 422) {
      return formatApiDetail(apiError.detail) ?? 'Некорректные данные заметки';
    }
    if (apiError.status >= 400 && apiError.status < 500) {
      return apiError.message || 'Ошибка сохранения заметки';
    }
  }
  return 'Не удалось сохранить заметку';
}
