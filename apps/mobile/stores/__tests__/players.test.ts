/**
 * @file: players.test.ts
 * @description: Тесты tableStore + Players API (FB-5)
 * @dependencies: jest, table store
 * @created: 2025-01-30
 * @updated: 2026-06-20
 */

import { tableStore, Tag } from '../table';

jest.mock('../../services/logger', () => ({
  logPlayerCreate: jest.fn(),
  logger: {
    logEvent: jest.fn(),
    logMetric: jest.fn(),
  },
}));

jest.mock('../../services/api/playersApi', () => ({
  playersApi: {
    createPlayer: jest.fn().mockResolvedValue({
      id: 42,
      name: 'API Player',
      content: '',
      created_at: '2026-01-01T00:00:00Z',
    }),
    getPlayers: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    }),
  },
}));

jest.mock('../../services/api/notesApi', () => ({
  notesApi: {
    createNote: jest.fn(),
    getNotes: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 1,
      offset: 0,
    }),
  },
}));

jest.mock('../../services/sync/syncQueue', () => ({
  syncQueue: {
    add: jest.fn().mockResolvedValue('sync_op_1'),
  },
}));

describe('Players Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tableStore.resetState();
  });

  it('createPlayer сохраняет backendId из API', async () => {
    const player = await tableStore.createPlayer('Villain1', [Tag.FISH], 1);
    expect(player.backendId).toBe(42);
    expect(tableStore.allPlayers[0].name).toBe('Villain1');
  });

  it('syncPlayersFromApi мержит игроков с backend', async () => {
    const { playersApi } = require('../../services/api/playersApi');
    playersApi.getPlayers.mockResolvedValueOnce({
      items: [
        {
          id: 7,
          name: 'Из API',
          tags: ['LAG'],
          content: '',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });

    await tableStore.syncPlayersFromApi();
    expect(tableStore.listPlayers().some((p) => p.name === 'Из API')).toBe(true);
  });

  it('offline create ставит в syncQueue', async () => {
    const { playersApi } = require('../../services/api/playersApi');
    const { syncQueue } = require('../../services/sync/syncQueue');
    playersApi.createPlayer.mockRejectedValueOnce(new Error('Network request failed'));

    await tableStore.createPlayer('Offline', [Tag.NIT]);

    expect(syncQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'player',
        type: 'create',
      })
    );
  });
});
