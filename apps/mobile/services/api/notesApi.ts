/**
 * @file: notesApi.ts
 * @description: API для работы с заметками
 * @dependencies: apiClient
 * @created: 2025-01-30
 */

import { apiClient } from './client';

export interface Note {
  id: number;
  user_id: number;
  text: string;
  tags: string[];
  player_id?: number | null;
  table_id?: number | null;
  session_id?: number | null;
  note_type?: string;
  street?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface NoteCreate {
  text: string;
  tags?: string[];
  player_id?: number;
  table_id?: number;
  session_id?: number;
  note_type?: 'exploit' | 'read' | 'general' | 'timing' | 'sizing';
  street?: 'preflop' | 'flop' | 'turn' | 'river';
}

export interface NoteUpdate extends NoteCreate {}

export interface NoteListResponse {
  items: Note[];
  total: number;
  limit: number;
  offset: number;
}

export interface NoteFilters {
  player_id?: number;
  table_id?: number;
  tags?: string[];
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export const notesApi = {
  async getNotes(filters?: NoteFilters): Promise<NoteListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    
    const queryString = params.toString();
    const endpoint = queryString ? `/notes?${queryString}` : '/notes';
    return apiClient.get<NoteListResponse>(endpoint);
  },

  async getNote(noteId: number): Promise<Note> {
    return apiClient.get<Note>(`/notes/${noteId}`);
  },

  async createNote(note: NoteCreate): Promise<Note> {
    return apiClient.post<Note>('/notes', note);
  },

  async updateNote(noteId: number, note: NoteUpdate): Promise<Note> {
    return apiClient.put<Note>(`/notes/${noteId}`, note);
  },

  async deleteNote(noteId: number): Promise<void> {
    return apiClient.delete<void>(`/notes/${noteId}`);
  },
};
