/**
 * @file: noteTagsApi.ts
 * @description: API справочника быстрых тегов заметки (SC-7 CRUD)
 * @dependencies: apiClient
 * @created: 2026-07-18
 */

import { apiClient } from './client';
import type { NoteTagDef } from '../../constants/quickNoteTags';

export type NoteTagApi = {
  id: number;
  code: string;
  label: string;
  group_id: string;
  sort_order: number;
  is_system: boolean;
};

export type NoteTagListResponse = {
  items: NoteTagApi[];
};

export type NoteTagCreate = {
  label: string;
  group_id: string;
  code?: string;
};

export type NoteTagUpdate = {
  label?: string;
  group_id?: string;
  sort_order?: number;
};

export function mapApiNoteTagToDef(row: NoteTagApi): NoteTagDef {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    groupId: row.group_id,
    sortOrder: row.sort_order,
    isSystem: row.is_system,
  };
}

export const noteTagsApi = {
  async list(): Promise<NoteTagListResponse> {
    return apiClient.get<NoteTagListResponse>('/note-tags');
  },

  async create(body: NoteTagCreate): Promise<NoteTagApi> {
    return apiClient.post<NoteTagApi>('/note-tags', body);
  },

  async update(tagId: number, body: NoteTagUpdate): Promise<NoteTagApi> {
    return apiClient.put<NoteTagApi>(`/note-tags/${tagId}`, body);
  },

  async delete(tagId: number): Promise<void> {
    return apiClient.delete<void>(`/note-tags/${tagId}`);
  },

  async reorder(
    items: { id: number; sort_order: number }[]
  ): Promise<NoteTagListResponse> {
    return apiClient.put<NoteTagListResponse>('/note-tags/reorder', { items });
  },
};
