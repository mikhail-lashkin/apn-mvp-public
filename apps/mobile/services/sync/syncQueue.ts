/**
 * @file: syncQueue.ts
 * @description: Очередь изменений для синхронизации
 * @dependencies: AsyncStorage
 * @created: 2025-01-30
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_QUEUE_KEY = '@apn:sync_queue';

export type SyncEntity = 'note' | 'table' | 'session' | 'player' | 'player_tag' | 'note_tag';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: SyncEntity;
  entityId: string;
  data?: any;
  timestamp: number;
  retryCount: number;
}

class SyncQueue {
  private queue: SyncOperation[] = [];

  async load(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  async add(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const syncOp: SyncOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    this.queue.push(syncOp);
    await this.save();
    return id;
  }

  async remove(operationId: string): Promise<void> {
    this.queue = this.queue.filter(op => op.id !== operationId);
    await this.save();
  }

  /** Убрать устаревшие update/delete того же entityId перед новой операцией. */
  async dropStaleForEntity(entity: SyncEntity, entityId: string): Promise<void> {
    const before = this.queue.length;
    this.queue = this.queue.filter(
      (op) => !(op.entity === entity && op.entityId === entityId && op.type !== 'create')
    );
    if (this.queue.length !== before) {
      await this.save();
    }
  }

  async incrementRetry(operationId: string): Promise<void> {
    const op = this.queue.find(o => o.id === operationId);
    if (op) {
      op.retryCount++;
      await this.save();
    }
  }

  getAll(): SyncOperation[] {
    return [...this.queue];
  }

  getPending(): SyncOperation[] {
    return this.queue.filter(op => op.retryCount < 3);
  }

  clear(): void {
    this.queue = [];
    AsyncStorage.removeItem(SYNC_QUEUE_KEY).catch(console.error);
  }

  size(): number {
    return this.queue.length;
  }
}

export const syncQueue = new SyncQueue();
