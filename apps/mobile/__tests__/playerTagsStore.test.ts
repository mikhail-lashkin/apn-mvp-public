/**
 * @file: playerTagsStore.test.ts
 * @description: SC-6 шаг 2 — optimistic CRUD + legacy normalize
 * @created: 2026-07-17
 */

import { PLAYER_TAG_SEED, normalizePlayerTagCode } from '../constants/playerTags';
import { playerTagsStore } from '../stores/playerTags';

const mockSyncAdd = jest.fn().mockResolvedValue('op_1');
const mockSyncRemove = jest.fn().mockResolvedValue(undefined);
const mockSyncDropStale = jest.fn().mockResolvedValue(undefined);
const mockSyncGetPending = jest.fn().mockReturnValue([]);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: false, isInternetReachable: false }),
}));

jest.mock('../services/api/client', () => ({
  apiClient: { getAccessToken: jest.fn().mockReturnValue(null) },
}));

jest.mock('../services/api/playerTagsApi', () => ({
  playerTagsApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    reorder: jest.fn(),
  },
  mapApiTagToDef: jest.fn((t) => t),
}));

jest.mock('../services/sync/syncQueue', () => ({
  syncQueue: {
    add: (...args: unknown[]) => mockSyncAdd(...args),
    remove: (...args: unknown[]) => mockSyncRemove(...args),
    dropStaleForEntity: (...args: unknown[]) => mockSyncDropStale(...args),
    getPending: () => mockSyncGetPending(),
  },
}));

describe('playerTagsStore CRUD (offline)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSyncGetPending.mockReturnValue([]);
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);
    await playerTagsStore.hydrate();
  });

  it('normalize не схлопывает custom slug в fish', () => {
    expect(normalizePlayerTagCode('custom_abc')).toBe('custom_abc');
    expect(normalizePlayerTagCode('my_tag')).toBe('my_tag');
  });

  it('createTag добавляет метку и ставит в syncQueue', async () => {
    const before = playerTagsStore.getState().tags.length;
    const created = await playerTagsStore.createTag('Bluffer', '#EC4899');
    expect(created.label).toBe('Bluffer');
    expect(created.isSystem).toBe(false);
    expect(playerTagsStore.getState().tags.length).toBe(before + 1);
    expect(mockSyncAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'create',
        entity: 'player_tag',
        data: expect.objectContaining({ label: 'Bluffer', color: '#EC4899' }),
      })
    );
  });

  it('updateTag меняет label локально', async () => {
    const created = await playerTagsStore.createTag('Temp', '#3B82F6');
    playerTagsStore.applyBackendId(String(created.id), 42, { id: 42 });
    await playerTagsStore.updateTag(42, { label: 'Renamed' });
    const row = playerTagsStore.getState().tags.find((t) => t.id === 42);
    expect(row?.label).toBe('Renamed');
    expect(mockSyncDropStale).toHaveBeenCalledWith('player_tag', '42');
    expect(mockSyncAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'update',
        entity: 'player_tag',
        entityId: '42',
      })
    );
  });

  it('deleteTag убирает из списка', async () => {
    const created = await playerTagsStore.createTag('ToDelete', '#6B7280');
    playerTagsStore.applyBackendId(String(created.id), 77, { id: 77 });
    await playerTagsStore.deleteTag(77);
    expect(playerTagsStore.getState().tags.find((t) => t.id === 77)).toBeUndefined();
    expect(mockSyncAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'delete',
        entity: 'player_tag',
        entityId: '77',
      })
    );
  });

  it('moveTag меняет sortOrder', async () => {
    const tags = playerTagsStore.getState().tags;
    const first = tags[0];
    const second = tags[1];
    playerTagsStore.applyBackendId(first.code, 1, { id: 1 });
    playerTagsStore.applyBackendId(second.code, 2, { id: 2 });
    await playerTagsStore.moveTag(1, 'down');
    const sorted = [...playerTagsStore.getState().tags].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    expect(sorted[0].code).toBe(second.code);
    expect(sorted[1].code).toBe(first.code);
  });

  it('seed остаётся 8 после hydrate без кэша', () => {
    expect(playerTagsStore.getState().tags).toHaveLength(PLAYER_TAG_SEED.length);
  });
});
