/**
 * @file: auth.ts
 * @description: Глобальный стор авторизации (FB-1)
 * @dependencies: authApi, apiClient, AsyncStorage
 * @created: 2026-06-18
 * @updated: 2026-07-14
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, User } from '../services/api/authApi';
import { apiClient, ApiError } from '../services/api/client';
import { formatApiDetail } from '../services/api/errors';

export { formatApiDetail };

export type AuthNavigationHandler = () => void;

const CACHED_USER_KEY = '@apn:cached_user';

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionRestored: boolean;
};

const emptyState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionRestored: false,
};

let currentState: AuthState = { ...emptyState };
const subscribers = new Set<() => void>();
let navigationHandler: AuthNavigationHandler | null = null;

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback());
};

const patchState = (partial: Partial<AuthState>) => {
  currentState = { ...currentState, ...partial };
  notifySubscribers();
};

function isNetworkAuthError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes('Network') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Request failed after retries') ||
      msg.includes('timed out') ||
      msg.includes('ECONNREFUSED')
    );
  }
  return false;
}

function isAuthExpiredError(error: unknown): boolean {
  if (error instanceof Error && error.message === 'Authentication failed') {
    return true;
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return (error as ApiError).status === 401;
  }
  return false;
}

async function cacheUser(user: User): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } catch {
    // кэш не критичен
  }
}

async function readCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function clearCachedUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHED_USER_KEY);
  } catch {
    // ignore
  }
}

export function mapAuthError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const apiError = error as ApiError;
    const detailText = formatApiDetail(apiError.detail);

    if (apiError.status === 401) {
      return detailText ?? 'Неверный email или пароль';
    }
    if (apiError.status === 400) {
      const text = detailText ?? apiError.message;
      if (text.includes('уже существует')) {
        return 'Аккаунт уже создан — нажмите «Войти» с тем же email и паролем';
      }
      return text;
    }
    if (apiError.status === 422) {
      return (
        detailText ??
        'Проверьте email (формат name@mail.com) и пароль (от 6 символов)'
      );
    }
    if (typeof apiError.message === 'string' && apiError.message !== 'Request failed') {
      return formatApiDetail(apiError.message) ?? apiError.message;
    }
  }

  if (error instanceof Error) {
    const errWithStatus = error as Error & { status?: number; detail?: unknown };
    if (errWithStatus.status === 401) {
      return formatApiDetail(errWithStatus.detail) ?? 'Неверный email или пароль';
    }
    if (isNetworkAuthError(error)) {
      return 'Нет подключения к интернету';
    }
    if (error.message === 'Authentication failed') {
      return 'Сессия истекла, войдите снова';
    }
    return error.message;
  }

  return 'Произошла ошибка';
}

export const authStore = {
  get user() {
    return currentState.user;
  },
  get accessToken() {
    return currentState.accessToken;
  },
  get isAuthenticated() {
    return currentState.isAuthenticated;
  },
  get isLoading() {
    return currentState.isLoading;
  },
  get error() {
    return currentState.error;
  },
  get sessionRestored() {
    return currentState.sessionRestored;
  },

  setNavigationHandler(handler: AuthNavigationHandler | null): void {
    navigationHandler = handler;
  },

  clearSession(): void {
    void clearCachedUser();
    patchState({
      ...emptyState,
      sessionRestored: currentState.sessionRestored,
    });
  },

  async login(email: string, password: string): Promise<void> {
    patchState({ isLoading: true, error: null });

    try {
      const tokens = await authApi.login({ email, password });
      const user = await authApi.getCurrentUser();
      await cacheUser(user);

      patchState({
        user,
        accessToken: tokens.access_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        sessionRestored: true,
      });
    } catch (error) {
      patchState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: mapAuthError(error),
      });
      throw error;
    }
  },

  async register(email: string, password: string, fullName?: string): Promise<void> {
    patchState({ isLoading: true, error: null });

    try {
      await authApi.register({
        email,
        password,
        full_name: fullName,
      });
      // бэкенд не отдаёт токены на register — логинимся сразу после
      await authStore.login(email, password);
    } catch (error) {
      if (!currentState.isAuthenticated) {
        patchState({
          isLoading: false,
          error: mapAuthError(error),
        });
      }
      throw error;
    }
  },

  async logout(): Promise<void> {
    patchState({ isLoading: true, error: null });

    try {
      await authApi.logout();
    } finally {
      await clearCachedUser();
      patchState({
        ...emptyState,
        sessionRestored: true,
        isLoading: false,
      });
      navigationHandler?.();
    }
  },

  async restoreSession(): Promise<void> {
    patchState({ isLoading: true, error: null });

    try {
      await apiClient.reloadTokensFromStorage();
      const token = apiClient.getAccessToken();

      if (!token) {
        await clearCachedUser();
        patchState({
          ...emptyState,
          sessionRestored: true,
          isLoading: false,
        });
        return;
      }

      try {
        const user = await authApi.getCurrentUser();
        await cacheUser(user);
        patchState({
          user,
          accessToken: token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          sessionRestored: true,
        });
      } catch (error) {
        // Офлайн / нет сети — оставляем сессию по сохранённому токену
        if (isNetworkAuthError(error)) {
          const cachedUser = await readCachedUser();
          patchState({
            user: cachedUser,
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            sessionRestored: true,
          });
          return;
        }

        // 401 / протухший токен — только тогда сбрасываем
        if (isAuthExpiredError(error)) {
          await apiClient.clearTokens();
          await clearCachedUser();
          patchState({
            ...emptyState,
            sessionRestored: true,
            isLoading: false,
            error: mapAuthError(error),
          });
          return;
        }

        // Прочие ошибки /me — не выкидываем офлайн-пользователя
        const cachedUser = await readCachedUser();
        patchState({
          user: cachedUser,
          accessToken: token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          sessionRestored: true,
        });
      }
    } catch (error) {
      patchState({
        ...emptyState,
        sessionRestored: true,
        isLoading: false,
        error: mapAuthError(error),
      });
    }
  },

  /** только для тестов */
  __resetForTests(): void {
    currentState = { ...emptyState };
    navigationHandler = null;
    notifySubscribers();
  },
};

apiClient.setUnauthorizedHandler(() => {
  authStore.clearSession();
  navigationHandler?.();
});

export const subscribeAuth = (callback: () => void) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

export const useAuthStore = () => {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    return subscribeAuth(forceUpdate);
  }, []);

  return authStore;
};
