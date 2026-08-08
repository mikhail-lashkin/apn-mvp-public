/**
 * @file: notes-save.test.ts
 * @description: FB-4 — saveNote / loadLastNoteFromApi
 * @created: 2026-06-20
 */

import { tableStore, Tag } from '../table';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    }),
  },
}));

jest.mock('../../services/logger', () => ({
  logPlayerCreate: jest.fn(),
  logger: { logEvent: jest.fn(), logMetric: jest.fn() },
}));

jest.mock('../../services/api/playersApi', () => ({
  playersApi: {
    createPlayer: jest.fn().mockResolvedValue({
      id: 5,
      name: 'Villain',
      content: '',
      created_at: '2026-01-01T00:00:00Z',
    }),
    getPlayers: jest.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
  },
}));

jest.mock('../../services/api/notesApi', () => ({
  notesApi: {
    createNote: jest.fn().mockResolvedValue({
      id: 77,
      user_id: 1,
      text: 'note text',
      tags: ['Fish'],
      player_id: 5,
      created_at: '2026-06-20T10:00:00Z',
    }),
    getNotes: jest.fn().mockResolvedValue({
      items: [
        {
          id: 88,
          user_id: 1,
          text: 'Из API',
          tags: ['Aggro'],
          player_id: 5,
          created_at: '2026-06-20T11:00:00Z',
        },
      ],
      total: 1,
      limit: 1,
      offset: 0,
    }),
  },
}));

jest.mock('../../services/sync/syncQueue', () => ({
  syncQueue: {
    add: jest.fn().mockResolvedValue('sync_note_1'),
  },
}));

describe('FB-4 notes API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tableStore.resetState();
  });

  it('saveNote создаёт заметку в API и локально', async () => {
    const player = await tableStore.createPlayer('Villain', [Tag.FISH]);
    const { notesApi } = require('../../services/api/notesApi');

    const result = await tableStore.saveNote(player.id, {
      text: 'Donk flop',
      tags: ['Fish'],
    });

    expect(result.synced).toBe(true);
    expect(notesApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Donk flop',
        player_id: 5,
        note_type: 'general',
      })
    );
    expect(tableStore.getLastNote(player.id)?.backendId).toBe(77);
  });

  it('saveNote при сетевой ошибке ставит в очередь и сохраняет локально', async () => {
    const { notesApi } = require('../../services/api/notesApi');
    const { syncQueue } = require('../../services/sync/syncQueue');
    notesApi.createNote.mockRejectedValueOnce(new Error('Network request failed'));

    const player = await tableStore.createPlayer('Offline', [Tag.NIT]);
    const result = await tableStore.saveNote(player.id, {
      text: 'Local only',
      tags: [],
    });

    expect(result.synced).toBe(false);
    expect(syncQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'note', type: 'create' })
    );
    expect(tableStore.getLastNote(player.id)?.text).toBe('Local only');
  });

  it('saveNote в airplane сразу в очередь без вызова API', async () => {
    const NetInfo = require('@react-native-community/netinfo').default;
    const { notesApi } = require('../../services/api/notesApi');
    const { syncQueue } = require('../../services/sync/syncQueue');
    // createPlayer тоже смотрит NetInfo — offline на оба вызова
    NetInfo.fetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const player = await tableStore.createPlayer('AirHero', [Tag.AGGRO]);
    const result = await tableStore.saveNote(player.id, {
      text: 'FB-6 offline',
      tags: ['Aggro'],
    });

    expect(result.synced).toBe(false);
    expect(notesApi.createNote).not.toHaveBeenCalled();
    expect(syncQueue.add).toHaveBeenCalled();
    expect(tableStore.getLastNote(player.id)?.text).toBe('FB-6 offline');

    NetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it('syncPlayersFromApi при пустом API убирает синкнутых, offline-only оставляет', async () => {
    const player = await tableStore.createPlayer('Villain', [Tag.FISH]);
    expect(player.backendId).toBe(5);

    await tableStore.syncPlayersFromApi();

    expect(tableStore.getPlayer(player.id)).toBeNull();
    expect(tableStore.listPlayers()).toHaveLength(0);
  });

  it('syncPlayersFromApi сохраняет заметки при смене backendId на том же id', async () => {
    const { playersApi } = require('../../services/api/playersApi');
    const player = await tableStore.createPlayer('Иван', [Tag.FISH]);
    tableStore.appendNote(player.id, { text: 'заметка Ивана', tags: ['FISH'] });

    playersApi.getPlayers.mockResolvedValueOnce({
      items: [
        {
          id: 5,
          name: 'Иван',
          tags: ['FISH'],
          content: '',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });

    await tableStore.syncPlayersFromApi();

    expect(tableStore.getPlayer(player.id)?.backendId).toBe(5);
    expect(tableStore.getLastNote(player.id)?.text).toBe('заметка Ивана');
  });

  it('saveNote пересоздаёт игрока при устаревшем backendId (500 FK)', async () => {
    const { notesApi } = require('../../services/api/notesApi');
    const { playersApi } = require('../../services/api/playersApi');

    const player = await tableStore.createPlayer('StaleHero', [Tag.FISH]);

    notesApi.createNote
      .mockRejectedValueOnce({
        status: 500,
        message: 'Internal Server Error',
        detail: 'Internal Server Error',
      })
      .mockResolvedValueOnce({
        id: 88,
        user_id: 1,
        text: 'recovered note',
        tags: [],
        player_id: 12,
        created_at: '2026-06-20T12:00:00Z',
      });

    playersApi.createPlayer.mockResolvedValueOnce({
      id: 12,
      name: 'StaleHero',
      content: '',
      created_at: '2026-01-01T00:00:00Z',
    });

    const result = await tableStore.saveNote(player.id, {
      text: 'recovered note',
      tags: [],
    });

    expect(result.synced).toBe(true);
    expect(playersApi.createPlayer).toHaveBeenCalledTimes(2);
    expect(notesApi.createNote).toHaveBeenCalledTimes(2);
    expect(tableStore.getPlayer(player.id)?.backendId).toBe(12);
  });

  it('saveNote при 422 не сохраняет локально', async () => {
    const { notesApi } = require('../../services/api/notesApi');
    notesApi.createNote.mockRejectedValueOnce({
      status: 422,
      message: 'validation',
      detail: 'bad note',
    });

    const player = await tableStore.createPlayer('Bad', [Tag.TAG]);

    await expect(
      tableStore.saveNote(player.id, { text: 'x', tags: [] })
    ).rejects.toMatchObject({ status: 422 });

    expect(tableStore.getLastNote(player.id)).toBeNull();
  });

  it('loadLastNoteFromApi подтягивает последнюю заметку', async () => {
    const player = await tableStore.createPlayer('Hero', [Tag.LAG]);
    await tableStore.loadLastNoteFromApi(player.id);

    const note = tableStore.getLastNote(player.id);
    expect(note?.text).toBe('Из API');
    expect(note?.backendId).toBe(88);
  });

  it('saveNote сохраняет кириллицу для демо-игрока стола', async () => {
    const { playersApi } = require('../../services/api/playersApi');
    const { notesApi } = require('../../services/api/notesApi');

    playersApi.createPlayer.mockResolvedValueOnce({
      id: 99,
      name: 'Алексей',
      content: '',
      created_at: '2026-01-01T00:00:00Z',
    });
    notesApi.createNote.mockResolvedValueOnce({
      id: 200,
      user_id: 1,
      text: 'Донк на флопе',
      tags: ['Fish'],
      player_id: 99,
      created_at: '2026-06-20T12:00:00Z',
    });

    const playerId = tableStore.ensurePlayerForQuickNote('player-0', 'Алексей', 0);
    const result = await tableStore.saveNote(playerId, {
      text: 'Донк на флопе',
      tags: ['Fish'],
    });

    expect(result.synced).toBe(true);
    expect(notesApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Донк на флопе',
        player_id: 99,
      })
    );
    expect(tableStore.getLastNote(playerId)?.text).toBe('Донк на флопе');
  });

  it('loadLastNoteFromApi не затирает более свежую локальную заметку', async () => {
    const player = await tableStore.createPlayer('Hero', [Tag.LAG]);
    tableStore.upsertNote(player.id, {
      text: 'Новая русская заметка',
      tags: [],
    });

    const { notesApi } = require('../../services/api/notesApi');
    notesApi.getNotes.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          user_id: 1,
          text: 'Old english note',
          tags: [],
          player_id: 5,
          created_at: '2020-01-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 1,
      offset: 0,
    });

    await tableStore.loadLastNoteFromApi(player.id);
    expect(tableStore.getLastNote(player.id)?.text).toBe('Новая русская заметка');
  });

  it('resolvePlayerIdForNotes находит игрока по имени (бейдж на столе)', async () => {
    tableStore.ensurePlayerForQuickNote('player-3', 'Дмитрий', 3);

    const apiPlayer = await tableStore.createPlayer('Дмитрий', [Tag.TAG]);
    await tableStore.saveNote(apiPlayer.id, { text: 'Заметка', tags: [] });

    const resolved = tableStore.resolvePlayerIdForNotes('player-3', 'Дмитрий');
    expect(resolved).toBe(apiPlayer.id);
    expect(tableStore.getNoteCount(resolved)).toBe(1);
    // по имени заметки видны и со stub-сиденья
    expect(tableStore.getNoteCount('player-3')).toBe(1);
  });
});
