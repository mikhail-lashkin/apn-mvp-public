/**
 * @file: sessionsApi.ts
 * @description: API для работы с сессиями
 * @dependencies: apiClient
 * @created: 2025-01-30
 */

import { apiClient } from './client';

export interface Session {
  id: number;
  user_id: number;
  table_id?: number;
  start_time: string;
  end_time?: string;
  buy_in?: number;
  cash_out?: number;
  profit?: number;
  duration_minutes?: number;
  notes_count: number;
  created_at: string;
  updated_at: string;
}

export interface SessionCreate {
  table_id?: number;
  buy_in?: number;
  start_time?: string;
}

export interface SessionUpdate {
  end_time?: string;
  cash_out?: number;
  notes_count?: number;
}

export interface SessionListResponse {
  items: Session[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionStatistics {
  total_sessions: number;
  total_profit: number;
  total_duration_minutes: number;
  total_notes: number;
  average_profit: number;
  average_duration_minutes: number;
}

export const sessionsApi = {
  async getSessions(tableId?: number, limit = 50, offset = 0): Promise<SessionListResponse> {
    const params = new URLSearchParams();
    if (tableId) params.append('table_id', String(tableId));
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    
    return apiClient.get<SessionListResponse>(`/sessions?${params.toString()}`);
  },

  async getSession(sessionId: number): Promise<Session> {
    return apiClient.get<Session>(`/sessions/${sessionId}`);
  },

  async getStatistics(): Promise<SessionStatistics> {
    return apiClient.get<SessionStatistics>('/sessions/statistics');
  },

  async createSession(session: SessionCreate): Promise<Session> {
    return apiClient.post<Session>('/sessions', session);
  },

  async updateSession(sessionId: number, session: SessionUpdate): Promise<Session> {
    return apiClient.put<Session>(`/sessions/${sessionId}`, session);
  },

  async deleteSession(sessionId: number): Promise<void> {
    return apiClient.delete<void>(`/sessions/${sessionId}`);
  },
};
