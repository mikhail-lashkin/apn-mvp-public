/**
 * @file: index.ts
 * @description: Базовые стейт-менеджеры
 * @dependencies: -
 * @created: 2025-01-27
 * @updated: 2025-01-28
 */

// Экспорт стейт-менеджеров
export const stores = {
  // Базовые типы для стейта
  createStore: <T>(initialState: T) => {
    let currentState = initialState;
    return {
      get state() { return currentState; },
      setState: (newState: T) => {
        currentState = newState;
        return { state: newState };
      },
    };
  },
};

// Экспорт tableStore для управления состоянием стола
export { tableStore, useTableStore, subscribe, Tag } from './table';
export { mapNoteSaveError } from '../services/api/errors';
export type { Player, Note } from './table';

// Auth store (FB-1)
export { authStore, useAuthStore, subscribeAuth, mapAuthError } from './auth';
