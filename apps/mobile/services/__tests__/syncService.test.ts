/**
 * @file: syncService.test.ts
 * @description: FB-6 — SyncService + NetInfo
 * @created: 2026-07-05
 */

import { syncService, isNetworkOnline } from '../sync/syncService';
import { syncQueue } from '../sync/syncQueue';

const mockNetInfoCallback = { current: null as ((state: unknown) => void) | null };
const mockUnsubscribe = jest.fn();

const mockGetAccessToken = jest.fn().mockReturnValue('test-token');

jest.mock('../api/client', () => ({
  apiClient: {
    getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    }),
    addEventListener: jest.fn((cb) => {
      mockNetInfoCallback.current = cb;
      return mockUnsubscribe;
    }),
  },
}));

jest.mock('../sync/syncQueue', () => ({
  syncQueue: {
    load: jest.fn().mockResolvedValue(undefined),
    getPending: jest.fn().mockReturnValue([]),
    getAll: jest.fn().mockReturnValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
    incrementRetry: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue('op_1'),
    size: jest.fn().mockReturnValue(0),
  },
}));

jest.mock('../api/notesApi', () => ({
  notesApi: {
    createNote: jest.fn().mockResolvedValue({
      id: 501,
      text: 'Offline note',
      tags: ['Fish'],
      user_id: 1,
      created_at: '2026-07-05T00:00:00Z',
    }),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
  },
}));

jest.mock('../api/playersApi', () => ({
  playersApi: {
    createPlayer: jest.fn().mockResolvedValue({
      id: 88,
      name: 'Villain',
      content: '',
      created_at: '2026-07-05T00:00:00Z',
    }),
    updatePlayer: jest.fn(),
    deletePlayer: jest.fn(),
  },
}));

jest.mock('../api/tablesApi', () => ({
  tablesApi: {
    createTable: jest.fn(),
    updateTable: jest.fn(),
    deleteTable: jest.fn(),
  },
}));

jest.mock('../api/sessionsApi', () => ({
  sessionsApi: {
    createSession: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
  },
}));

jest.mock('../../stores/table', () => ({
  tableStore: {
    applyBackendId: jest.fn(),
    upsertNote: jest.fn(),
    appendNote: jest.fn(),
  },
}));

describe('FB-6 syncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    syncService.__resetForTests();
    mockGetAccessToken.mockReturnValue('test-token');
    (syncQueue.getPending as jest.Mock).mockReturnValue([]);
    (syncQueue.size as jest.Mock).mockReturnValue(0);
  });

  it('isNetworkOnline: offline когда isConnected=false', () => {
    expect(
      isNetworkOnline({ isConnected: false, isInternetReachable: true } as never)
    ).toBe(false);
  });

  it('isNetworkOnline: online когда isInternetReachable=null (Android)', () => {
    expect(
      isNetworkOnline({ isConnected: true, isInternetReachable: null } as never)
    ).toBe(true);
  });

  it('initialize загружает очередь и подписывается на NetInfo', async () => {
    const NetInfo = require('@react-native-community/netinfo').default;

    await syncService.initialize();
    await syncService.initialize();

    expect(syncQueue.load).toHaveBeenCalledTimes(1);
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('sync выполняет create_note и удаляет из очереди', async () => {
    const { notesApi } = require('../api/notesApi');
    const { tableStore } = require('../../stores/table');

    (syncQueue.getPending as jest.Mock).mockReturnValue([
      {
        id: 'op_note_1',
        type: 'create',
        entity: 'note',
        entityId: 'note_local_1',
        data: {
          text: 'Offline note',
          tags: ['Fish'],
          note_type: 'general',
          localPlayerId: 'player-1',
        },
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]);
    (syncQueue.size as jest.Mock).mockReturnValue(1);

    await syncService.sync();

    expect(notesApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Offline note',
        note_type: 'general',
      })
    );
    expect(notesApi.createNote).not.toHaveBeenCalledWith(
      expect.objectContaining({ localPlayerId: expect.anything() })
    );
    expect(tableStore.appendNote).toHaveBeenCalledWith(
      'player-1',
      expect.objectContaining({ backendId: 501 })
    );
    expect(syncQueue.remove).toHaveBeenCalledWith('op_note_1');
  });

  it('sync выполняет create_player и обновляет backendId', async () => {
    const { playersApi } = require('../api/playersApi');
    const { tableStore } = require('../../stores/table');

    (syncQueue.getPending as jest.Mock).mockReturnValue([
      {
        id: 'op_player_1',
        type: 'create',
        entity: 'player',
        entityId: 'local_player_99',
        data: {
          name: 'Villain',
          tags: ['FISH'],
          content: '',
          localPlayerId: 'local_player_99',
        },
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]);

    await syncService.sync();

    expect(playersApi.createPlayer).toHaveBeenCalledWith({
      name: 'Villain',
      tags: ['FISH'],
      content: '',
    });
    expect(tableStore.applyBackendId).toHaveBeenCalledWith('local_player_99', 88);
    expect(syncQueue.remove).toHaveBeenCalledWith('op_player_1');
  });

  it('sync не выполняется офлайн', async () => {
    const NetInfo = require('@react-native-community/netinfo').default;
    NetInfo.fetch.mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    });

    (syncQueue.getPending as jest.Mock).mockReturnValue([
      {
        id: 'op_note_2',
        type: 'create',
        entity: 'note',
        entityId: 'x',
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]);

    await syncService.sync();

    const { notesApi } = require('../api/notesApi');
    expect(notesApi.createNote).not.toHaveBeenCalled();
    expect(syncQueue.remove).not.toHaveBeenCalled();
  });

  it('sync не выполняется без access token (экран логина)', async () => {
    mockGetAccessToken.mockReturnValue(null);

    (syncQueue.getPending as jest.Mock).mockReturnValue([
      {
        id: 'op_no_auth',
        type: 'create',
        entity: 'note',
        entityId: 'note_x',
        data: { text: 'x', tags: [], note_type: 'general' },
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]);

    await syncService.sync();

    const { notesApi } = require('../api/notesApi');
    expect(notesApi.createNote).not.toHaveBeenCalled();
    expect(syncQueue.remove).not.toHaveBeenCalled();
    expect(syncQueue.incrementRetry).not.toHaveBeenCalled();
  });

  it('sync при 401 не увеличивает retryCount', async () => {
    const { notesApi } = require('../api/notesApi');
    notesApi.createNote.mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });

    (syncQueue.getPending as jest.Mock).mockReturnValue([
      {
        id: 'op_401',
        type: 'create',
        entity: 'note',
        entityId: 'note_x',
        data: { text: 'x', tags: [], note_type: 'general' },
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]);

    await syncService.sync();

    expect(syncQueue.incrementRetry).not.toHaveBeenCalled();
    expect(syncQueue.remove).not.toHaveBeenCalled();
  });

  it('sync delete player: 404 считается success (идемпотентность)', async () => {
    const { playersApi } = require('../api/playersApi');
    playersApi.deletePlayer.mockRejectedValueOnce({
      status: 404,
      message: 'Игрок не найден',
    });

    (syncQueue.getPending as jest.Mock).mockReturnValue([
      {
        id: 'op_del_404',
        type: 'delete',
        entity: 'player',
        entityId: '55',
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]);

    await syncService.sync();

    expect(playersApi.deletePlayer).toHaveBeenCalledWith(55);
    expect(syncQueue.remove).toHaveBeenCalledWith('op_del_404');
    expect(syncQueue.incrementRetry).not.toHaveBeenCalled();
  });

  it('sync при ошибке увеличивает retryCount', async () => {
    const { notesApi } = require('../api/notesApi');
    notesApi.createNote.mockRejectedValueOnce(new Error('Network failed'));

    (syncQueue.getPending as jest.Mock).mockReturnValue([
      {
        id: 'op_fail',
        type: 'create',
        entity: 'note',
        entityId: 'note_x',
        data: { text: 'x', tags: [], note_type: 'general' },
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]);
    (syncQueue.getAll as jest.Mock).mockReturnValue([
      { id: 'op_fail', retryCount: 1 },
    ]);

    await syncService.sync();

    expect(syncQueue.incrementRetry).toHaveBeenCalledWith('op_fail');
    expect(syncQueue.remove).not.toHaveBeenCalled();
    expect(syncService.getStatus().error).toBe('Network failed');
  });

  it('NetInfo listener запускает sync при восстановлении сети', async () => {
    await syncService.initialize();

    const syncSpy = jest.spyOn(syncService, 'sync').mockResolvedValue(undefined);

    mockNetInfoCallback.current?.({ isConnected: true, isInternetReachable: true });

    expect(syncSpy).toHaveBeenCalled();
    syncSpy.mockRestore();
  });
});
