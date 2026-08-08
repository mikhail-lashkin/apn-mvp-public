/**
 * @file: authApi.ts
 * @description: API для аутентификации
 * @dependencies: apiClient
 * @created: 2025-01-30
 */

import { apiClient, ApiError } from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

function formatAuthErrorBody(errorData: {
  detail?: unknown;
  message?: string;
}): ApiError {
  const detail = errorData.detail;
  let message = 'Request failed';
  if (typeof detail === 'string') {
    message = detail;
  } else if (Array.isArray(detail) && detail[0]?.msg) {
    message = detail[0].msg;
  } else if (errorData.message) {
    message = errorData.message;
  }
  return { message, status: 0, detail };
}

export const authApi = {
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const baseUrl = apiClient.getBaseUrl();
    // RN Android: body должен быть строкой, не URLSearchParams
    const body = `username=${encodeURIComponent(credentials.email)}&password=${encodeURIComponent(credentials.password)}`;
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const parsed = formatAuthErrorBody(errorData);
      const error: ApiError = { ...parsed, status: response.status };
      throw error;
    }

    const data: TokenResponse = await response.json();
    await apiClient.setTokens(data.access_token, data.refresh_token);
    return data;
  },

  async register(userData: RegisterRequest): Promise<User> {
    return apiClient.post<User>('/auth/register', userData);
  },

  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await apiClient.clearTokens();
    }
  },
};
