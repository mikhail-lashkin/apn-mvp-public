/**
 * @file: offline-online-flow.test.ts
 * @description: Реалистичные кейсы: онлайн Иван → Airplane Пётр → sync без потери notes
 * @created: 2026-07-14
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
    createPlayer: jest.fn(),
    getPlayers: jest.fn(),
  },
}));

jest.mock('../../services/api/notesApi', () => ({
  notesApi: {
    createNote: jest.fn(),
    getNotes: jest.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
  },
}));

jest.mock('../../services/sync/syncQueue', () => ({
  syncQueue: {
    add: jest.fn().mockResolvedValue('qid'),
  },
}));

type NetState = { isConnected: boolean; isInternetReachable: boolean };

const online: NetState = { isConnected: true, isInternetReachable: true };
const offline: NetState = { isConnected: false, isInternetReachable: false };

const setNet = (state: NetState) => {
  const NetInfo = require('@react-native-community/netinfo').default;
  NetInfo.fetch.mockResolvedValue(state);
};

describe('UA: стол — онлайн / airplane / sync', () => {
  const { playersApi } = require('../../services/api/playersApi');
  const { notesApi } = require('../../services/api/notesApi');
  const { syncQueue } = require('../../services/sync/syncQueue');

  beforeEach(() => {
    jest.clearAllMocks();
    tableStore.resetState();
    setNet(online);

    playersApi.createPlayer.mockImplementation(async (payload: { name: string }) => ({
      id: payload.name === 'Иван' ? 101 : 202,
      name: payload.name,
      tags: [],
      content: '',
      created_at: '2026-07-14T00:00:00Z',
    }));

    notesApi.createNote.mockImplementation(
      async (payload: { text: string; player_id?: number }) => ({
        id: payload.player_id === 101 ? 1001 : 2002,
        user_id: 2,
        text: payload.text,
        tags: payload.tags ?? [],
        player_id: payload.player_id ?? null,
        created_at: new Date().toISOString(),
      })
    );

    playersApi.getPlayers.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
  });

  it('кейс 1: онлайн посадил Ивана и дал заметку', async () => {
    const ivan = await tableStore.createPlayer('Иван', [Tag.AGGRO], 0);
    expect(ivan.backendId).toBe(101);
    expect(playersApi.createPlayer).toHaveBeenCalled();

    const saved = await tableStore.saveNote(ivan.id, {
      text: '3bet light из BTN',
      tags: ['AGGRO'],
    });

    expect(saved.synced).toBe(true);
    expect(notesApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({ player_id: 101, text: '3bet light из BTN' })
    );
    expect(tableStore.getLastNote(ivan.id)?.text).toBe('3bet light из BTN');
    expect(tableStore.getNoteCount(ivan.id)).toBe(1);
  });

  it('кейс 2: airplane — новый Пётр сразу локально, без зависания на API', async () => {
    setNet(online);
    const ivan = await tableStore.createPlayer('Иван', [Tag.FISH], 0);
    await tableStore.saveNote(ivan.id, { text: 'Иван online', tags: [] });

    playersApi.createPlayer.mockClear();
    notesApi.createNote.mockClear();
    syncQueue.add.mockClear();

    setNet(offline);
    const started = Date.now();
    const petr = await tableStore.createPlayer('Пётр', [Tag.NIT], 1);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(200);
    expect(petr.backendId).toBeNull();
    expect(playersApi.createPlayer).not.toHaveBeenCalled();
    expect(syncQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'player', type: 'create' })
    );

    const note = await tableStore.saveNote(petr.id, {
      text: 'Пётр офлайн nit',
      tags: ['NIT'],
    });
    expect(note.synced).toBe(false);
    expect(notesApi.createNote).not.toHaveBeenCalled();
    expect(tableStore.getLastNote(petr.id)?.text).toBe('Пётр офлайн nit');

    // Иван не задет
    expect(tableStore.getLastNote(ivan.id)?.text).toBe('Иван online');
  });

  it('кейс 3: после sync Ивана notes на месте, Пётр остаётся offline-only', async () => {
    setNet(online);
    const ivan = await tableStore.createPlayer('Иван', [Tag.AGGRO], 0);
    await tableStore.saveNote(ivan.id, { text: 'первая Ивана', tags: ['AGGRO'] });

    setNet(offline);
    const petr = await tableStore.createPlayer('Пётр', [Tag.PASSIVE], 2);
    await tableStore.saveNote(petr.id, { text: 'заметка Петра', tags: [] });

    setNet(online);
    // Сервер знает только Ивана (Пётр ещё в syncQueue)
    playersApi.getPlayers.mockResolvedValueOnce({
      items: [
        {
          id: 101,
          name: 'Иван',
          tags: ['AGGRO'],
          content: '',
          created_at: '2026-07-14T00:00:00Z',
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });

    await tableStore.syncPlayersFromApi();

    const ivanAfter = tableStore.getPlayer(ivan.id);
    expect(ivanAfter?.backendId).toBe(101);
    expect(ivanAfter?.name).toBe('Иван');
    expect(tableStore.getLastNote(ivan.id)?.text).toBe('первая Ивана');
    expect(tableStore.getNoteCount(ivan.id)).toBe(1);

    const petrAfter = tableStore.listPlayers().find((p) => p.name === 'Пётр');
    expect(petrAfter).toBeTruthy();
    expect(petrAfter!.backendId).toBeNull();
    expect(tableStore.getLastNote(petrAfter!.id)?.text).toBe('заметка Петра');
  });

  it('кейс 4: повторный sync не дублирует и не затирает историю Ивана', async () => {
    setNet(online);
    const ivan = await tableStore.createPlayer('Иван', [Tag.TAG], 0);
    await tableStore.saveNote(ivan.id, { text: 'n1', tags: [] });
    tableStore.appendNote(ivan.id, { text: 'n2 локальная', tags: ['TAG'] });

    playersApi.getPlayers.mockResolvedValue({
      items: [
        {
          id: 101,
          name: 'Иван',
          tags: ['TAG'],
          content: '',
          created_at: '2026-07-14T00:00:00Z',
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });

    await tableStore.syncPlayersFromApi();
    await tableStore.syncPlayersFromApi();

    expect(tableStore.getNoteCount(ivan.id)).toBe(2);
    expect(tableStore.getLastNote(ivan.id)?.text).toBe('n2 локальная');
    expect(tableStore.listPlayers().filter((p) => p.name === 'Иван')).toHaveLength(1);
  });

  it('кейс 5: пустой API после wipe — синкнутый Иван уходит, незалитый Пётр остаётся', async () => {
    setNet(online);
    const ivan = await tableStore.createPlayer('Иван', [Tag.FISH], 0);
    await tableStore.saveNote(ivan.id, { text: 'будет потеряна при wipe сервера', tags: [] });

    setNet(offline);
    const petr = await tableStore.createPlayer('Пётр', [Tag.REG], 1);
    await tableStore.saveNote(petr.id, { text: 'offline only', tags: [] });

    setNet(online);
    playersApi.getPlayers.mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    });

    await tableStore.syncPlayersFromApi();

    expect(tableStore.listPlayers().some((p) => p.name === 'Иван')).toBe(false);
    expect(tableStore.getLastNote(ivan.id)).toBeNull();

    const petrLeft = tableStore.listPlayers().find((p) => p.name === 'Пётр');
    expect(petrLeft).toBeTruthy();
    expect(tableStore.getLastNote(petrLeft!.id)?.text).toBe('offline only');
  });

  it('кейс 6: resolvePlayerIdForNotes находит Ивана после sync (бейдж на сиденье)', async () => {
    setNet(online);
    const ivan = await tableStore.createPlayer('Иван', [Tag.LAG], 3);
    await tableStore.saveNote(ivan.id, { text: 'для бейджа', tags: [] });

    playersApi.getPlayers.mockResolvedValueOnce({
      items: [
        {
          id: 101,
          name: 'Иван',
          tags: ['LAG'],
          content: '',
          created_at: '2026-07-14T00:00:00Z',
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });
    await tableStore.syncPlayersFromApi();

    const seatKey = tableStore.resolvePlayerIdForNotes('empty', 'Иван');
    expect(tableStore.getNoteCount(seatKey)).toBeGreaterThanOrEqual(1);
    expect(tableStore.getLastNote(seatKey)?.text).toBe('для бейджа');
  });
});
