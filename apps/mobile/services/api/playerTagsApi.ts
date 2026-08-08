/**
 * @file: playerTagsApi.ts
 * @description: API справочника меток игрока (SC-6 CRUD)
 * @dependencies: apiClient
 * @created: 2026-07-15
 * @updated: 2026-07-17
 */

import { apiClient } from './client';
import type { PlayerTagDef } from '../../constants/playerTags';

export type PlayerTagApi = {
  id: number;
  code: string;
  label: string;
  color: string;
  sort_order: number;
  is_system: boolean;
};

export type PlayerTagListResponse = {
  items: PlayerTagApi[];
};

export type PlayerTagCreate = {
  label: string;
  color: string;
  code?: string;
};

export type PlayerTagUpdate = {
  label?: string;
  color?: string;
  sort_order?: number;
};

export function mapApiTagToDef(row: PlayerTagApi): PlayerTagDef {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    color: row.color,
    sortOrder: row.sort_order,
    isSystem: row.is_system,
  };
}

export const playerTagsApi = {
  async list(): Promise<PlayerTagListResponse> {
    return apiClient.get<PlayerTagListResponse>('/player-tags');
  },

  async create(body: PlayerTagCreate): Promise<PlayerTagApi> {
    return apiClient.post<PlayerTagApi>('/player-tags', body);
  },

  async update(tagId: number, body: PlayerTagUpdate): Promise<PlayerTagApi> {
    return apiClient.put<PlayerTagApi>(`/player-tags/${tagId}`, body);
  },

  async delete(tagId: number): Promise<void> {
    return apiClient.delete<void>(`/player-tags/${tagId}`);
  },

  async reorder(items: { id: number; sort_order: number }[]): Promise<PlayerTagListResponse> {
    return apiClient.put<PlayerTagListResponse>('/player-tags/reorder', { items });
  },
};
