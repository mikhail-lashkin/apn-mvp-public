/**
 * @file: index.ts
 * @description: Экспорт сервисов синхронизации
 * @created: 2025-01-30
 */

export { syncQueue, SyncOperation } from './syncQueue';
export { syncService, SyncStatus, isNetworkOnline } from './syncService';
