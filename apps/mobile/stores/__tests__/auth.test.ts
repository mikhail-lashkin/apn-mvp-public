/**
 * @file: auth.test.ts
 * @description: Unit-тесты auth store (FB-1)
 * @dependencies: auth store, authApi, apiClient
 * @created: 2026-06-18
 * @updated: 2026-07-14
 */

import { authStore, mapAuthError } from '../auth';
import { authApi } from '../../services/api/authApi';
import { apiClient } from '../../services/api/client';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/api/authApi', () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    reloadTokensFromStorage: jest.fn(),
    getAccessToken: jest.fn(),
    clearTokens: jest.fn(),
    setUnauthorizedHandler: jest.fn(),
  },
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');

const mockUser = {
  id: 1,
  email: 'player@example.com',
  full_name: 'Player',
  is_active: true,
  is_verified: false,
  created_at: '2026-01-01T00:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStore.__resetForTests();
    (apiClient.reloadTokensFromStorage as jest.Mock).mockResolvedValue(undefined);
    (apiClient.getAccessToken as jest.Mock).mockReturnValue(null);
    (apiClient.clearTokens as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('login success: сохраняет user и токен', async () => {
    (authApi.login as jest.Mock).mockResolvedValue({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      token_type: 'bearer',
    });
    (authApi.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    await authStore.login('player@example.com', 'secret123');

    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.user?.email).toBe('player@example.com');
    expect(authStore.accessToken).toBe('access-1');
    expect(authStore.error).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@apn:cached_user',
      expect.any(String)
    );
  });

  it('login fail 401: сбрасывает сессию и пишет ошибку', async () => {
    const err = new Error('Неверный email или пароль') as Error & { status?: number };
    err.status = 401;
    (authApi.login as jest.Mock).mockRejectedValue(err);

    await expect(authStore.login('bad@example.com', 'wrong')).rejects.toThrow();

    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.error).toBe('Неверный email или пароль');
  });

  it('login fail 422: показывает ошибку валидации', async () => {
    (authApi.login as jest.Mock).mockRejectedValue({
      status: 422,
      message: 'Validation error',
      detail: 'password too short',
    });

    await expect(authStore.login('a@b.com', '1')).rejects.toBeTruthy();

    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.error).toBe('password too short');
  });

  it('restoreSession с протухшим токеном очищает сессию', async () => {
    (apiClient.getAccessToken as jest.Mock).mockReturnValue('stale-token');
    (authApi.getCurrentUser as jest.Mock).mockRejectedValue(
      new Error('Authentication failed')
    );

    await authStore.restoreSession();

    expect(apiClient.clearTokens).toHaveBeenCalled();
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.sessionRestored).toBe(true);
    expect(authStore.isLoading).toBe(false);
  });

  it('restoreSession офлайн сохраняет сессию по токену', async () => {
    (apiClient.getAccessToken as jest.Mock).mockReturnValue('offline-token');
    (authApi.getCurrentUser as jest.Mock).mockRejectedValue(
      new TypeError('Network request failed')
    );
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));

    await authStore.restoreSession();

    expect(apiClient.clearTokens).not.toHaveBeenCalled();
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.accessToken).toBe('offline-token');
    expect(authStore.user?.email).toBe('player@example.com');
    expect(authStore.sessionRestored).toBe(true);
  });

  it('restoreSession без токена завершается без запроса /me', async () => {
    await authStore.restoreSession();

    expect(authApi.getCurrentUser).not.toHaveBeenCalled();
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.sessionRestored).toBe(true);
  });

  it('logout очищает сессию и вызывает navigationHandler', async () => {
    const navHandler = jest.fn();
    authStore.setNavigationHandler(navHandler);

    (authApi.login as jest.Mock).mockResolvedValue({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      token_type: 'bearer',
    });
    (authApi.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (authApi.logout as jest.Mock).mockResolvedValue(undefined);

    await authStore.login('player@example.com', 'secret123');
    await authStore.logout();

    expect(authApi.logout).toHaveBeenCalled();
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.user).toBeNull();
    expect(authStore.sessionRestored).toBe(true);
    expect(navHandler).toHaveBeenCalled();
  });

  it('register вызывает login после успешной регистрации', async () => {
    (authApi.register as jest.Mock).mockResolvedValue(mockUser);
    (authApi.login as jest.Mock).mockResolvedValue({
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      token_type: 'bearer',
    });
    (authApi.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    await authStore.register('new@example.com', 'secret123', 'New User');

    expect(authApi.register).toHaveBeenCalled();
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret123',
    });
    expect(authStore.isAuthenticated).toBe(true);
  });
});

describe('mapAuthError', () => {
  it('мапит сетевую ошибку', () => {
    expect(mapAuthError(new Error('Network request failed'))).toBe(
      'Нет подключения к интернету'
    );
  });
});
