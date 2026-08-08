/**
 * @file: client.ts
 * @description: Базовый API клиент для взаимодействия с backend
 * @dependencies: AsyncStorage
 * @created: 2025-01-30
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Local API by default. Override with EXPO_PUBLIC_API_URL at build time. */
const DEFAULT_API_URL = 'http://127.0.0.1:8000';

function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (__DEV__) {
    const { Platform } = require('react-native');
    if (Platform.OS === 'android') {
      return 'http://127.0.0.1:8000';
    }
    return 'http://localhost:8000';
  }
  return DEFAULT_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

const TOKEN_KEY = '@apn:access_token';
const REFRESH_TOKEN_KEY = '@apn:refresh_token';

export interface ApiError {
  message: string;
  status: number;
  detail?: string;
}

type UnauthorizedHandler = () => void;

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private unauthorizedHandler: UnauthorizedHandler | null = null;
  private tokensLoaded = false;
  private tokensLoadPromise: Promise<void> | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    void this.loadTokens();
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
    this.unauthorizedHandler = handler;
  }

  /** Ждём чтение токенов из AsyncStorage — нужно перед restoreSession */
  async reloadTokensFromStorage(): Promise<void> {
    if (this.tokensLoadPromise) {
      await this.tokensLoadPromise;
      return;
    }

    this.tokensLoadPromise = this.loadTokens().finally(() => {
      this.tokensLoadPromise = null;
    });

    await this.tokensLoadPromise;
  }

  private async loadTokens(): Promise<void> {
    try {
      this.accessToken = await AsyncStorage.getItem(TOKEN_KEY);
      this.refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      this.tokensLoaded = true;
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  }

  async setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokensLoaded = true;
    try {
      await AsyncStorage.setItem(TOKEN_KEY, accessToken);
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  private notifyUnauthorized() {
    this.unauthorizedHandler?.();
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async performRefresh(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await this.setTokens(data.access_token, data.refresh_token);
        return true;
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }

    return false;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3
  ): Promise<T> {
    if (!this.tokensLoaded && !this.tokensLoadPromise) {
      await this.reloadTokensFromStorage();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (response.status === 401 && attempt === 0) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
            continue;
          }

          await this.clearTokens();
          this.notifyUnauthorized();
          throw new Error('Authentication failed');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const detail = errorData.detail;
          let message = 'Request failed';
          if (typeof detail === 'string') {
            message = detail;
          } else if (Array.isArray(detail) && detail[0]?.msg) {
            message = detail[0].msg;
          } else if (errorData.message) {
            message = errorData.message;
          }
          const error: ApiError = {
            message,
            status: response.status,
            detail,
          };
          throw error;
        }

        if (response.status === 204) {
          return null as T;
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        const isApiError =
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof (error as ApiError).status === 'number';

        if (isApiError || (error instanceof Error && !error.message.includes('Network'))) {
          throw error;
        }

        if (attempt < retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
