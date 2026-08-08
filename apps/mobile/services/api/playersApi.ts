/**
 * @file: playersApi.ts
 * @description: API для работы с профилями игроков
 * @dependencies: apiClient
 * @created: 2025-01-30
 */

import { apiClient } from './client';

export interface Player {
  id: number;
  name: string;
  style?: string;
  patterns?: any[];
  leaks?: any[];
  exploits?: any[];
  traps?: any[];
  regions?: any[];
  tags?: any[];
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface PlayerCreate {
  name: string;
  style?: string;
  content?: string;
  patterns?: any[];
  leaks?: any[];
  exploits?: any[];
  traps?: any[];
  regions?: any[];
  tags?: any[];
}

export interface PlayerUpdate {
  name?: string;
  style?: string;
  content?: string;
  patterns?: any[];
  leaks?: any[];
  exploits?: any[];
  traps?: any[];
  regions?: any[];
  tags?: any[];
}

export interface PlayerListResponse {
  items: Player[];
  total: number;
  limit: number;
  offset: number;
}

export interface PlayerStatistics {
  player_id: number;
  name: string;
  style?: string;
  notes_count: number;
  patterns_count: number;
  leaks_count: number;
}

export const playersApi = {
  async getPlayers(search?: string, style?: string, limit = 50, offset = 0): Promise<PlayerListResponse> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (style) params.append('style', style);
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    
    return apiClient.get<PlayerListResponse>(`/players?${params.toString()}`);
  },

  async getPlayer(playerId: number): Promise<Player> {
    return apiClient.get<Player>(`/players/${playerId}`);
  },

  async getPlayerStatistics(playerId: number): Promise<PlayerStatistics> {
    return apiClient.get<PlayerStatistics>(`/players/${playerId}/statistics`);
  },

  async createPlayer(player: PlayerCreate): Promise<Player> {
    return apiClient.post<Player>('/players', player);
  },

  async updatePlayer(playerId: number, player: PlayerUpdate): Promise<Player> {
    return apiClient.put<Player>(`/players/${playerId}`, player);
  },

  async deletePlayer(playerId: number): Promise<void> {
    return apiClient.delete<void>(`/players/${playerId}`);
  },
};
