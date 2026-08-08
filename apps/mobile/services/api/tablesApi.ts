/**
 * @file: tablesApi.ts
 * @description: API для работы со столами
 * @dependencies: apiClient
 * @created: 2025-01-30
 */

import { apiClient } from './client';

export interface Table {
  id: number;
  user_id: number;
  name: string;
  size: number;
  hero_position?: number;
  location?: string;
  limits?: string;
  created_at: string;
  updated_at: string;
}

export interface TableCreate {
  name: string;
  size: number;
  hero_position?: number;
  location?: string;
  limits?: string;
}

export interface TableUpdate {
  name?: string;
  size?: number;
  hero_position?: number;
  location?: string;
  limits?: string;
}

export interface TableListResponse {
  items: Table[];
  total: number;
  limit: number;
  offset: number;
}

export const tablesApi = {
  async getTables(limit = 50, offset = 0): Promise<TableListResponse> {
    return apiClient.get<TableListResponse>(`/tables?limit=${limit}&offset=${offset}`);
  },

  async getTable(tableId: number): Promise<Table> {
    return apiClient.get<Table>(`/tables/${tableId}`);
  },

  async createTable(table: TableCreate): Promise<Table> {
    return apiClient.post<Table>('/tables', table);
  },

  async updateTable(tableId: number, table: TableUpdate): Promise<Table> {
    return apiClient.put<Table>(`/tables/${tableId}`, table);
  },

  async deleteTable(tableId: number): Promise<void> {
    return apiClient.delete<void>(`/tables/${tableId}`);
  },
};
