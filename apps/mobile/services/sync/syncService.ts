/**
 * @file: syncService.ts
 * @description: Сервис синхронизации данных между клиентом и сервером (FB-6)
 * @dependencies: syncQueue, NetInfo, api services
 * @created: 2025-01-30
 * @updated: 2026-07-05
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncQueue, SyncOperation } from './syncQueue';
import { notesApi } from '../api/notesApi';
import { tablesApi } from '../api/tablesApi';
import { sessionsApi } from '../api/sessionsApi';
import { playersApi } from '../api/playersApi';
import { playerTagsApi, mapApiTagToDef } from '../api/playerTagsApi';
import { noteTagsApi, mapApiNoteTagToDef } from '../api/noteTagsApi';
import { tableStore } from '../../stores/table';
import { playerTagsStore } from '../../stores/playerTags';
import { tablesStore } from '../../stores/tables';
import { noteTagsStore } from '../../stores/noteTags';
import { apiClient, ApiError } from '../api/client';

export interface SyncStatus {
  isSyncing: boolean;
  pendingOperations: number;
  lastSyncTime: number | null;
  error: string | null;
}

export function isNetworkOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function isAuthSyncError(error: unknown): boolean {
  if (error instanceof Error && error.message === 'Authentication failed') {
    return true;
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return (error as ApiError).status === 401;
  }
  return false;
}

class SyncService {
  private isSyncing = false;
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;
  private initialized = false;
  private unsubscribeNetInfo: (() => void) | null = null;
  private syncListeners = new Set<(status: SyncStatus) => void>();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    await syncQueue.load();

    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (isNetworkOnline(state)) {
        void this.sync();
      }
    });
  }

  getStatus(): SyncStatus {
    return {
      isSyncing: this.isSyncing,
      pendingOperations: syncQueue.size(),
      lastSyncTime: this.lastSyncTime,
      error: this.lastError,
    };
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.syncListeners.forEach((listener) => listener(status));
  }

  private canSync(): boolean {
    return Boolean(apiClient.getAccessToken());
  }

  async sync(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    if (!this.canSync()) {
      return;
    }

    const networkState = await NetInfo.fetch();
    if (!isNetworkOnline(networkState)) {
      return;
    }

    const pending = syncQueue.getPending();
    if (pending.length === 0) {
      return;
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifyListeners();

    try {
      for (const operation of pending) {
        try {
          await this.executeOperation(operation);
          await syncQueue.remove(operation.id);
        } catch (error) {
          if (isAuthSyncError(error)) {
            // Нет сессии — очередь сохраняем до входа, без retry и без LogBox
            break;
          }

          const message = error instanceof Error ? error.message : 'Sync operation failed';
          console.warn(`Sync operation ${operation.id} failed:`, message);
          this.lastError = message;
          await syncQueue.incrementRetry(operation.id);

          const updatedOp = syncQueue.getAll().find((op) => op.id === operation.id);
          if (updatedOp && updatedOp.retryCount >= 3) {
            await syncQueue.remove(operation.id);
          }
        }
      }

      this.lastSyncTime = Date.now();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      console.warn('Sync failed:', message);
      this.lastError = message;
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    switch (operation.entity) {
      case 'note':
        await this.syncNote(operation);
        break;
      case 'table':
        await this.syncTable(operation);
        break;
      case 'session':
        await this.syncSession(operation);
        break;
      case 'player':
        await this.syncPlayer(operation);
        break;
      case 'player_tag':
        await this.syncPlayerTag(operation);
        break;
      case 'note_tag':
        await this.syncNoteTag(operation);
        break;
    }
  }

  private async syncNote(operation: SyncOperation): Promise<void> {
    const { localPlayerId, ...rawPayload } = operation.data ?? {};

    switch (operation.type) {
      case 'create': {
        const created = await notesApi.createNote(rawPayload);
        if (typeof localPlayerId === 'string') {
          tableStore.appendNote(localPlayerId, {
            text: created.text,
            tags: created.tags ?? [],
            backendId: created.id,
          });
        }
        break;
      }
      case 'update': {
        const noteId = Number(operation.entityId);
        if (Number.isNaN(noteId)) {
          throw new Error(`Invalid note id for update: ${operation.entityId}`);
        }
        await notesApi.updateNote(noteId, rawPayload);
        break;
      }
      case 'delete': {
        const noteId = Number(operation.entityId);
        if (Number.isNaN(noteId)) {
          throw new Error(`Invalid note id for delete: ${operation.entityId}`);
        }
        await notesApi.deleteNote(noteId);
        break;
      }
    }
  }

  private async syncTable(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create': {
        const { localTableId, ...payload } = operation.data ?? {};
        const created = await tablesApi.createTable(payload);
        if (typeof localTableId === 'string') {
          tablesStore.applyBackendId(localTableId, created);
        }
        break;
      }
      case 'update': {
        const tableId = Number(operation.entityId);
        if (Number.isNaN(tableId)) {
          throw new Error(`Invalid table id for update: ${operation.entityId}`);
        }
        await tablesApi.updateTable(tableId, operation.data);
        break;
      }
      case 'delete': {
        const tableId = Number(operation.entityId);
        if (Number.isNaN(tableId)) {
          throw new Error(`Invalid table id for delete: ${operation.entityId}`);
        }
        await tablesApi.deleteTable(tableId);
        break;
      }
    }
  }

  private async syncSession(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        await sessionsApi.createSession(operation.data);
        break;
      case 'update':
        await sessionsApi.updateSession(operation.entityId, operation.data);
        break;
      case 'delete':
        await sessionsApi.deleteSession(operation.entityId);
        break;
    }
  }

  private async syncPlayer(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create': {
        const { localPlayerId, ...playerPayload } = operation.data ?? {};
        const created = await playersApi.createPlayer(playerPayload);
        const localId =
          typeof localPlayerId === 'string' ? localPlayerId : operation.entityId;
        tableStore.applyBackendId(localId, created.id);
        break;
      }
      case 'update': {
        const backendId = Number(operation.entityId);
        if (Number.isNaN(backendId)) {
          throw new Error(`Invalid player id for update: ${operation.entityId}`);
        }
        await playersApi.updatePlayer(backendId, operation.data);
        break;
      }
      case 'delete': {
        const backendId = Number(operation.entityId);
        if (Number.isNaN(backendId)) {
          throw new Error(`Invalid player id for delete: ${operation.entityId}`);
        }
        try {
          await playersApi.deletePlayer(backendId);
        } catch (error) {
          // Soft-delete уже применён / повтор — не роняем очередь
          if (
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            (error as ApiError).status === 404
          ) {
            break;
          }
          throw error;
        }
        break;
      }
    }
  }

  private async syncPlayerTag(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create': {
        const { localTagId, label, color } = operation.data ?? {};
        const created = await playerTagsApi.create({ label, color });
        const mapped = mapApiTagToDef(created);
        if (typeof localTagId === 'string') {
          playerTagsStore.applyBackendId(localTagId, created.id, mapped);
        }
        break;
      }
      case 'update': {
        if (operation.entityId === 'reorder' && operation.data?.items) {
          await playerTagsApi.reorder(operation.data.items);
          await playerTagsStore.refreshFromApi();
          break;
        }
        const tagId = Number(operation.entityId);
        if (Number.isNaN(tagId)) {
          throw new Error(`Invalid player_tag id: ${operation.entityId}`);
        }
        await playerTagsApi.update(tagId, operation.data ?? {});
        break;
      }
      case 'delete': {
        const tagId = Number(operation.entityId);
        if (Number.isNaN(tagId)) {
          throw new Error(`Invalid player_tag id: ${operation.entityId}`);
        }
        await playerTagsApi.delete(tagId);
        break;
      }
    }
  }

  private async syncNoteTag(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create': {
        const { localTagId, label, group_id } = operation.data ?? {};
        const created = await noteTagsApi.create({ label, group_id });
        const mapped = mapApiNoteTagToDef(created);
        if (typeof localTagId === 'string') {
          noteTagsStore.applyBackendId(localTagId, created.id, mapped);
        }
        break;
      }
      case 'update': {
        if (operation.entityId === 'reorder' && operation.data?.items) {
          await noteTagsApi.reorder(operation.data.items);
          await noteTagsStore.refreshFromApi();
          break;
        }
        const tagId = Number(operation.entityId);
        if (Number.isNaN(tagId)) {
          throw new Error(`Invalid note_tag id: ${operation.entityId}`);
        }
        await noteTagsApi.update(tagId, operation.data ?? {});
        break;
      }
      case 'delete': {
        const tagId = Number(operation.entityId);
        if (Number.isNaN(tagId)) {
          throw new Error(`Invalid note_tag id: ${operation.entityId}`);
        }
        await noteTagsApi.delete(tagId);
        break;
      }
    }
  }

  async queueOperation(
    type: 'create' | 'update' | 'delete',
    entity: 'note' | 'table' | 'session' | 'player' | 'player_tag' | 'note_tag',
    entityId: string,
    data?: unknown
  ): Promise<string> {
    const operationId = await syncQueue.add({ type, entity, entityId, data });

    const networkState = await NetInfo.fetch();
    if (isNetworkOnline(networkState) && this.canSync()) {
      void this.sync();
    }

    return operationId;
  }

  /** Только для unit-тестов */
  __resetForTests(): void {
    this.unsubscribeNetInfo?.();
    this.unsubscribeNetInfo = null;
    this.initialized = false;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.lastError = null;
    this.syncListeners.clear();
  }
}

export const syncService = new SyncService();
