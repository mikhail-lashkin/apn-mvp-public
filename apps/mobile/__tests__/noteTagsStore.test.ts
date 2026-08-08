/**
 * @file: noteTagsStore.test.ts
 * @description: SC-7 — optimistic CRUD note tags
 * @created: 2026-07-18
 */

import { NOTE_TAG_SEED } from '../constants/quickNoteTags';
import { noteTagsStore } from '../stores/noteTags';

const mockSyncAdd = jest.fn().mockResolvedValue('op_1');
const mockSyncRemove = jest.fn().mockResolvedValue(undefined);
const mockSyncDropStale = jest.fn().mockResolvedValue(undefined);
const mockSyncGetPending = jest.fn().mockReturnValue([]);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  }),
}));

jest.mock('../services/api/client', () => ({
  apiClient: { getAccessToken: jest.fn().mockReturnValue(null) },
}));

jest.mock('../services/api/noteTagsApi', () => ({
  noteTagsApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    reorder: jest.fn(),
  },
  mapApiNoteTagToDef: jest.fn((t) => t),
}));

jest.mock('../services/sync/syncQueue', () => ({
  syncQueue: {
    add: (...args: unknown[]) => mockSyncAdd(...args),
    remove: (...args: unknown[]) => mockSyncRemove(...args),
    dropStaleForEntity: (...args: unknown[]) => mockSyncDropStale(...args),
    getPending: () => mockSyncGetPending(),
  },
}));

describe('noteTagsStore CRUD (offline)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSyncGetPending.mockReturnValue([]);
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);
    await noteTagsStore.hydrate();
  });

  it('hydrate даёт seed SC-3', () => {
    expect(noteTagsStore.getState().tags.length).toBe(NOTE_TAG_SEED.length);
    expect(noteTagsStore.groups().map((g) => g.id)).toEqual([
      'preflop',
      'postflop',
      'bluff_timing',
      'stack',
    ]);
  });

  it('createTag добавляет тег и ставит в syncQueue', async () => {
    const before = noteTagsStore.getState().tags.length;
    const created = await noteTagsStore.createTag('SmokeTell', 'preflop');
    expect(created.label).toBe('SmokeTell');
    expect(created.groupId).toBe('preflop');
    expect(created.isSystem).toBe(false);
    expect(noteTagsStore.getState().tags.length).toBe(before + 1);
    expect(mockSyncAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'create',
        entity: 'note_tag',
        data: expect.objectContaining({
          label: 'SmokeTell',
          group_id: 'preflop',
        }),
      })
    );
  });

  it('updateTag меняет label локально', async () => {
    const created = await noteTagsStore.createTag('Temp', 'stack');
    noteTagsStore.applyBackendId(String(created.id), 42, { id: 42 });
    await noteTagsStore.updateTag(42, { label: 'Renamed' });
    const row = noteTagsStore.getState().tags.find((t) => t.id === 42);
    expect(row?.label).toBe('Renamed');
    expect(mockSyncDropStale).toHaveBeenCalledWith('note_tag', '42');
  });

  it('deleteTag убирает из списка', async () => {
    const created = await noteTagsStore.createTag('ToDelete', 'postflop');
    noteTagsStore.applyBackendId(String(created.id), 77, { id: 77 });
    await noteTagsStore.deleteTag(77);
    expect(noteTagsStore.getState().tags.find((t) => t.id === 77)).toBeUndefined();
    expect(mockSyncAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'delete',
        entity: 'note_tag',
        entityId: '77',
      })
    );
  });
});
