/**
 * @file: players-simple.test.ts
 * @description: Тесты управления игроками (FB-5, с mock playersApi)
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
    createPlayer: jest.fn().mockImplementation(async (payload: { name: string }) => ({
      id: 42,
      name: payload.name || 'API Player',
      content: '',
      created_at: '2026-01-01T00:00:00Z',
    })),
    updatePlayer: jest.fn().mockImplementation(async (id: number, payload: { name?: string }) => ({
      id,
      name: payload.name ?? 'Updated',
      content: '',
      created_at: '2026-01-01T00:00:00Z',
    })),
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

describe('Players Management - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tableStore.resetState();
  });

  describe('createPlayer', () => {
    it('should create a player with name, tags and backendId', async () => {
      const playerName = 'Тестовый игрок';
      const tags: Tag[] = [Tag.FISH, Tag.AGGRO];
      const seatIndex = 2;

      const player = await tableStore.createPlayer(playerName, tags, seatIndex);

      expect(player).toMatchObject({
        id: expect.stringMatching(/^player_\d+_[a-z0-9]+$/),
        backendId: 42,
        tableId: 'demo',
        seat: 3,
        name: playerName,
        // SC-6: single-select — только первая метка, нормализованная
        tags: [Tag.FISH],
      });

      expect(tableStore.allPlayers).toHaveLength(1);
      expect(tableStore.allPlayers[0].backendId).toBe(42);
    });

    it('should create a player without seat assignment', async () => {
      const player = await tableStore.createPlayer('Игрок без места', [Tag.PASSIVE]);

      expect(player.seat).toBe(0);
      expect(player.backendId).toBe(42);
    });

    it('should generate unique IDs for different players', async () => {
      const player1 = await tableStore.createPlayer('Игрок 1', [Tag.FISH]);
      const player2 = await tableStore.createPlayer('Игрок 2', [Tag.AGGRO]);

      expect(player1.id).not.toBe(player2.id);
    });
  });

  describe('listPlayers', () => {
    beforeEach(async () => {
      await tableStore.createPlayer('Алексей', [Tag.FISH, Tag.AGGRO]);
      await tableStore.createPlayer('Мария', [Tag.PASSIVE]);
      await tableStore.createPlayer('Дмитрий', [Tag.TAG]);
    });

    it('should return all players when no query provided', () => {
      const players = tableStore.listPlayers();
      expect(players).toHaveLength(3);
    });

    it('should filter players by name query', () => {
      const players = tableStore.listPlayers('алекс');
      expect(players).toHaveLength(1);
      expect(players[0].name).toBe('Алексей');
    });

    it('should return empty array for non-matching query', () => {
      expect(tableStore.listPlayers('несуществующий')).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const players = tableStore.listPlayers('МАРИЯ');
      expect(players[0].name).toBe('Мария');
    });
  });

  describe('assignSeat', () => {
    it('should assign existing player to seat', async () => {
      const player = await tableStore.createPlayer('Тестовый игрок', [Tag.FISH]);
      tableStore.assignSeat(3, player.id);

      expect(tableStore.seats[3].id).toBe(player.id);
      expect(tableStore.seats[3].seat).toBe(4);
    });

    it('should not assign non-existent player', () => {
      const initialSeats = [...tableStore.seats];
      tableStore.assignSeat(2, 'non-existent-id');
      expect(tableStore.seats).toEqual(initialSeats);
    });
  });

  describe('getPlayer', () => {
    it('should return player by ID', async () => {
      const player = await tableStore.createPlayer('Игрок для поиска', [Tag.LAG]);
      expect(tableStore.getPlayer(player.id)).toMatchObject({ name: 'Игрок для поиска' });
    });

    it('should return null for non-existent player', () => {
      expect(tableStore.getPlayer('non-existent-id')).toBeNull();
    });
  });

  describe('applyBackendId', () => {
    it('should set backendId on existing local player', async () => {
      const { playersApi } = require('../../services/api/playersApi');
      playersApi.createPlayer.mockRejectedValueOnce(new Error('Network request failed'));

      const player = await tableStore.createPlayer('Offline', [Tag.FISH]);
      expect(player.backendId).toBeNull();

      tableStore.applyBackendId(player.id, 99);
      expect(tableStore.getPlayer(player.id)?.backendId).toBe(99);
    });
  });

  describe('renamePlayer', () => {
    it('renames nameless local player and creates backend profile', async () => {
      const { playersApi } = require('../../services/api/playersApi');
      // первый create (безымянный) — без backendId
      playersApi.createPlayer.mockRejectedValueOnce(new Error('Network request failed'));

      const anon = await tableStore.createPlayer('', [], 4);
      expect(anon.backendId).toBeNull();
      expect(anon.name).toBe('');

      playersApi.createPlayer.mockClear();
      await tableStore.renamePlayer(anon.id, 'Сергей');

      const updated = tableStore.getPlayer(anon.id);
      expect(updated?.name).toBe('Сергей');
      expect(updated?.backendId).toBe(42);
      expect(playersApi.createPlayer).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Сергей' })
      );
      expect(playersApi.updatePlayer).not.toHaveBeenCalled();
    });

    it('updates existing backend player name via updatePlayer', async () => {
      const { playersApi } = require('../../services/api/playersApi');
      const player = await tableStore.createPlayer('Иван', [Tag.FISH], 0);
      expect(player.backendId).toBe(42);

      playersApi.createPlayer.mockClear();
      await tableStore.renamePlayer(player.id, 'Пётр');

      expect(tableStore.getPlayer(player.id)?.name).toBe('Пётр');
      expect(playersApi.updatePlayer).toHaveBeenCalledWith(42, { name: 'Пётр' });
    });
  });
});
