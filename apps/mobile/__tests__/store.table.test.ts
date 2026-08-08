/**
 * @file: store.table.test.ts
 * @description: Тесты для tableStore
 * @dependencies: tableStore
 * @created: 2025-01-28
 */

import { tableStore } from '../stores/table';

jest.mock('../services/logger', () => ({
  logPlayerCreate: jest.fn(),
  logger: { logEvent: jest.fn(), logMetric: jest.fn() },
}));

jest.mock('../services/api/playersApi', () => ({
  playersApi: {
    createPlayer: jest.fn(),
    deletePlayer: jest.fn().mockResolvedValue(undefined),
    getPlayers: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    }),
  },
}));

jest.mock('../services/api/notesApi', () => ({
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

jest.mock('../services/api/client', () => ({
  apiClient: {
    getAccessToken: jest.fn().mockReturnValue('test-token'),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    }),
  },
}));

const mockSyncAdd = jest.fn().mockResolvedValue('sync_op_1');
const mockSyncRemove = jest.fn().mockResolvedValue(undefined);
const mockSyncDropStale = jest.fn().mockResolvedValue(undefined);
const mockSyncGetAll = jest.fn().mockReturnValue([]);

jest.mock('../services/sync/syncQueue', () => ({
  syncQueue: {
    add: (...args: unknown[]) => mockSyncAdd(...args),
    remove: (...args: unknown[]) => mockSyncRemove(...args),
    dropStaleForEntity: (...args: unknown[]) => mockSyncDropStale(...args),
    getAll: (...args: unknown[]) => mockSyncGetAll(...args),
    getPending: jest.fn().mockReturnValue([]),
  },
}));

describe('tableStore', () => {
  beforeEach(() => {
    tableStore.resetState();
    jest.clearAllMocks();
    mockSyncGetAll.mockReturnValue([]);
  });

  describe('selectPlayer', () => {
    it('должен устанавливать selectedPlayerId', () => {
      expect(tableStore.selectedPlayerId).toBeNull();
      
      tableStore.selectPlayer('p1');
      expect(tableStore.selectedPlayerId).toBe('p1');
      
      tableStore.selectPlayer('p2');
      expect(tableStore.selectedPlayerId).toBe('p2');
      
      tableStore.selectPlayer(null);
      expect(tableStore.selectedPlayerId).toBeNull();
    });
  });

  describe('upsertNote', () => {
    it('должен создавать новую заметку', () => {
      const playerId = 'p1';
      const noteData = { text: 'Тестовая заметка', tags: ['Fish'] };
      
      tableStore.upsertNote(playerId, noteData);
      
      const notes = tableStore.notesByPlayerId[playerId];
      expect(notes).toHaveLength(1);
      expect(notes[0].text).toBe('Тестовая заметка');
      expect(notes[0].tags).toEqual(['Fish']);
      expect(notes[0].playerId).toBe(playerId);
      expect(notes[0].id).toBeDefined();
      expect(notes[0].createdAt).toBeDefined();
    });

    it('должен обновлять существующую заметку', () => {
      const playerId = 'p1';
      const initialData = { text: 'Первая заметка', tags: ['Fish'] };
      const updatedData = { text: 'Обновленная заметка', tags: ['Aggro'] };
      
      // Создаем первую заметку
      tableStore.upsertNote(playerId, initialData);
      const firstNote = tableStore.notesByPlayerId[playerId][0];
      
      // Обновляем заметку
      tableStore.upsertNote(playerId, updatedData);
      
      const notes = tableStore.notesByPlayerId[playerId];
      expect(notes).toHaveLength(1);
      expect(notes[0].text).toBe('Обновленная заметка');
      expect(notes[0].tags).toEqual(['Aggro']);
      expect(notes[0].id).toBe(firstNote.id); // ID должен остаться тот же
    });

    it('должен обновлять только текст, сохраняя теги', () => {
      const playerId = 'p1';
      const initialData = { text: 'Первая заметка', tags: ['Fish', 'Aggro'] };
      const updatedData = { text: 'Обновленный текст' };
      
      tableStore.upsertNote(playerId, initialData);
      tableStore.upsertNote(playerId, updatedData);
      
      const notes = tableStore.notesByPlayerId[playerId];
      expect(notes[0].text).toBe('Обновленный текст');
      expect(notes[0].tags).toEqual(['Fish', 'Aggro']);
    });

    it('должен обновлять только теги, сохраняя текст', () => {
      const playerId = 'p1';
      const initialData = { text: 'Тестовая заметка', tags: ['Fish'] };
      const updatedData = { tags: ['Aggro', 'Passive'] };
      
      tableStore.upsertNote(playerId, initialData);
      tableStore.upsertNote(playerId, updatedData);
      
      const notes = tableStore.notesByPlayerId[playerId];
      expect(notes[0].text).toBe('Тестовая заметка');
      expect(notes[0].tags).toEqual(['Aggro', 'Passive']);
    });
  });

  describe('getLastNote', () => {
    it('должен возвращать последнюю заметку игрока', () => {
      const playerId = 'p1';
      
      // Нет заметок
      expect(tableStore.getLastNote(playerId)).toBeNull();
      
      // Добавляем заметку
      tableStore.upsertNote(playerId, { text: 'Первая заметка', tags: ['Fish'] });
      const firstNote = tableStore.getLastNote(playerId);
      expect(firstNote?.text).toBe('Первая заметка');
      
      // Обновляем заметку
      tableStore.upsertNote(playerId, { text: 'Вторая заметка', tags: ['Aggro'] });
      const secondNote = tableStore.getLastNote(playerId);
      expect(secondNote?.text).toBe('Вторая заметка');
    });
  });

  describe('getNoteCount', () => {
    it('должен возвращать количество заметок игрока', () => {
      const playerId = 'p1';
      
      // Нет заметок
      expect(tableStore.getNoteCount(playerId)).toBe(0);
      
      // Добавляем заметку
      tableStore.upsertNote(playerId, { text: 'Заметка 1', tags: ['Fish'] });
      expect(tableStore.getNoteCount(playerId)).toBe(1);
      
      // Обновляем заметку (количество остается 1)
      tableStore.upsertNote(playerId, { text: 'Заметка 2', tags: ['Aggro'] });
      expect(tableStore.getNoteCount(playerId)).toBe(1);
    });
  });

  describe('инициализация', () => {
    it('должен иметь 8 сидений по умолчанию', () => {
      expect(tableStore.seats).toHaveLength(8);
      expect(tableStore.seats[0].id).toBe('p1');
      expect(tableStore.seats[0].seat).toBe(1);
      expect(tableStore.seats[7].id).toBe('p8');
      expect(tableStore.seats[7].seat).toBe(8);
    });

    it('должен иметь правильный tableId', () => {
      expect(tableStore.tableId).toBe('demo');
    });
  });

  describe('hidePlayer (MB-13)', () => {
    const NetInfo = require('@react-native-community/netinfo').default;
    const { playersApi } = require('../services/api/playersApi');

    beforeEach(() => {
      jest.useFakeTimers();
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('оптимистично убирает игрока и заметки; undo восстанавливает', async () => {
      const player = await tableStore.createPlayer('Вася', []);
      tableStore.appendNote(player.id, { text: 'bluff', tags: [] });
      expect(tableStore.getPlayer(player.id)).not.toBeNull();
      expect(tableStore.getNoteCount(player.id)).toBe(1);

      mockSyncAdd.mockClear();
      const result = await tableStore.hidePlayer(player.id);
      expect(result).not.toBeNull();
      expect(tableStore.getPlayer(player.id)).toBeNull();
      expect(tableStore.notesByPlayerId[player.id]).toBeUndefined();
      expect(mockSyncAdd).not.toHaveBeenCalled();

      const undone = await tableStore.undoHidePlayer(result!.undoToken);
      expect(undone).toBe(true);
      expect(tableStore.getPlayer(player.id)?.name).toBe('Вася');
      expect(tableStore.getNoteCount(player.id)).toBe(1);
    });

    it('после undo-окна вызывает deletePlayer по backendId', async () => {
      const player = await tableStore.createPlayer('Петя', []);
      tableStore.applyBackendId(player.id, 42);

      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      playersApi.deletePlayer.mockResolvedValue(undefined);

      await tableStore.hidePlayer(player.id);
      await jest.advanceTimersByTimeAsync(5000);

      expect(playersApi.deletePlayer).toHaveBeenCalledWith(42);
    });

    it('локальный игрок без backendId — снимает pending create, без delete', async () => {
      const player = await tableStore.createPlayer('Offline', []);
      mockSyncGetAll.mockReturnValue([
        {
          id: 'op_create_1',
          type: 'create',
          entity: 'player',
          entityId: player.id,
          data: { localPlayerId: player.id },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ]);

      await tableStore.hidePlayer(player.id);
      mockSyncAdd.mockClear();
      await jest.advanceTimersByTimeAsync(5000);

      expect(mockSyncRemove).toHaveBeenCalledWith('op_create_1');
      expect(mockSyncAdd).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'delete', entity: 'player' })
      );
    });
  });
});
