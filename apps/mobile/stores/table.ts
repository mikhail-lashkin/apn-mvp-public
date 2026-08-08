/**
 * @file: table.ts
 * @description: Стор покерного стола — игроки, заметки, FB-5 Players API
 * @dependencies: AsyncStorage, playersApi, syncQueue
 * @created: 2025-01-28
 * @updated: 2026-07-22
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { logPlayerCreate, logger } from '../services/logger';
import { playersApi, Player as ApiPlayer } from '../services/api/playersApi';
import { notesApi } from '../services/api/notesApi';
import { syncQueue } from '../services/sync/syncQueue';
import { apiClient, ApiError } from '../services/api/client';
import { formatApiDetail } from '../services/api/errors';
import { normalizePlayerTagCode } from '../constants/playerTags';

const isDeviceOnline = (state: NetInfoState): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

/** MB-13: окно undo до flush soft-hide в sync/API */
export const HIDE_PLAYER_UNDO_MS = 5000;

export type HidePlayerResult = {
  undoToken: string;
  undoUntil: number;
  relatedIds: string[];
};

/**
 * Метка игрока = ColorSystem slug (SC-6).
 * Legacy-алиасы сохранены для тестов/старых данных → нормализуются в store.
 */
export const Tag = {
  WHALE: 'whale',
  FISH: 'fish',
  PASSIVE_FISH: 'passive_fish',
  AGGRO_FISH: 'aggro_fish',
  VIP_AGGRESSIVE: 'vip_aggressive',
  TIGHT_REG: 'tight_reg',
  STANDARD_REG: 'standard_reg',
  UNKNOWN_SS: 'unknown_ss',
  // legacy aliases → normalize в ColorSystem
  NIT: 'tight_reg',
  AGGRO_REG: 'standard_reg',
  AGGRO: 'aggro_fish',
  PASSIVE: 'passive_fish',
  OVERBET: 'fish',
  UNDERDEF_BB: 'fish',
  TIMING: 'standard_reg',
  REG: 'standard_reg',
  LAG: 'standard_reg',
  TAG: 'tight_reg',
  VIP: 'whale',
  UNKNOWN: 'unknown',
} as const;

export type Tag = (typeof Tag)[keyof typeof Tag];

export type Player = {
  id: string;
  backendId: number | null;
  tableId: string;
  seat: number;
  name?: string;
  /** Single-select: 0 или 1 код ColorSystem. */
  tags?: Tag[];
  createdAt: string;
};

export type Note = {
  id: string;
  backendId?: number | null;
  playerId: string;
  text: string;
  createdAt: string;
  tags?: string[];
};

type PendingHide = {
  token: string;
  relatedIds: string[];
  players: Player[];
  notesSlice: Record<string, Note[]>;
  backendIds: number[];
  timer: ReturnType<typeof setTimeout>;
  flushed: boolean;
};

const pendingHides = new Map<string, PendingHide>();

const PLAYERS_STORAGE_KEY = 'allPlayers';
const NOTES_STORAGE_KEY = 'notesByPlayerId';

const initialSeats: Player[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `p${i + 1}`,
  backendId: null,
  tableId: 'demo',
  seat: i + 1,
  name: undefined,
  tags: [],
  createdAt: new Date().toISOString(),
}));

type TableState = {
  tableId: string;
  seats: Player[];
  selectedPlayerId: string | null;
  notesByPlayerId: Record<string, Note[]>;
  allPlayers: Player[];
};

type TableStore = TableState & {
  selectPlayer: (playerId: string | null) => void;
  upsertNote: (playerId: string, partial: { text?: string; tags?: string[]; backendId?: number | null }) => void;
  appendNote: (
    playerId: string,
    note: { text: string; tags: string[]; backendId?: number | null }
  ) => void;
  getLastNote: (playerId: string) => Note | null;
  getNoteCount: (playerId: string) => number;
  saveNote: (
    playerId: string,
    payload: { text: string; tags: string[] }
  ) => Promise<{ synced: boolean }>;
  loadLastNoteFromApi: (playerId: string) => Promise<void>;
  createPlayer: (name: string, tags: Tag[], seatIndex?: number) => Promise<Player>;
  listPlayers: (query?: string) => Player[];
  assignSeat: (seatIndex: number, playerId: string) => void;
  getPlayer: (playerId: string) => Player | null;
  applyBackendId: (localPlayerId: string, backendId: number) => void;
  /** SC-6: single-select метка ColorSystem (code или unknown). */
  setPlayerTag: (playerId: string, tagCode: string) => Promise<void>;
  /** Переименовать игрока (пустое имя = без имени). */
  renamePlayer: (playerId: string, name: string) => Promise<void>;
  /**
   * MB-13 soft-hide: убрать из allPlayers/мест/кэша заметок.
   * Sync/API через ~HIDE_PLAYER_UNDO_MS; до flush — undoHidePlayer.
   */
  hidePlayer: (playerId: string) => Promise<HidePlayerResult | null>;
  /** Отмена soft-hide, только пока операция не ушла в сеть/очередь. */
  undoHidePlayer: (undoToken: string) => Promise<boolean>;
  syncPlayersFromApi: () => Promise<void>;
  loadPlayersFromStorage: () => Promise<void>;
  savePlayersToStorage: () => Promise<void>;
  loadNotesFromStorage: () => Promise<void>;
  saveNotesToStorage: () => Promise<void>;
  ensurePlayerForQuickNote: (
    seatPlayerId: string,
    displayName?: string,
    seatIndex?: number
  ) => string;
  resolvePlayerIdForNotes: (seatPlayerId: string, displayName?: string) => string;
  resetState: () => void;
  /** Полный сброс локальных игроков/заметок (AsyncStorage + память). Auth не трогает. */
  clearLocalTableData: () => Promise<void>;
};

let currentState: TableState = {
  tableId: 'demo',
  seats: initialSeats,
  selectedPlayerId: null,
  notesByPlayerId: {},
  allPlayers: [],
};

const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback());
};

const generatePlayerId = (): string =>
  `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const normalizeStoredPlayer = (raw: Partial<Player>): Player => ({
  id: raw.id ?? generatePlayerId(),
  backendId: raw.backendId ?? null,
  tableId: raw.tableId ?? currentState.tableId,
  seat: raw.seat ?? 0,
  name: raw.name,
  tags: raw.tags ?? [],
  createdAt: raw.createdAt ?? new Date().toISOString(),
});

const mapApiTags = (tags: unknown): Tag[] => {
  if (!Array.isArray(tags)) {
    return [];
  }
  const codes = tags
    .map((t) => normalizePlayerTagCode(typeof t === 'string' ? t : String(t)))
    .filter((t) => t !== 'unknown');
  // single-select: только первая метка
  return codes.slice(0, 1) as Tag[];
};

const mapApiPlayerToLocal = (apiPlayer: ApiPlayer): Player => ({
  id: `player_backend_${apiPlayer.id}`,
  backendId: apiPlayer.id,
  tableId: currentState.tableId,
  seat: 0,
  name: apiPlayer.name,
  tags: mapApiTags(apiPlayer.tags),
  createdAt: apiPlayer.created_at,
});

const mergeApiPlayers = (localPlayers: Player[], apiPlayers: ApiPlayer[]): Player[] => {
  const locals = localPlayers.map(normalizeStoredPlayer);

  // Пустой ответ API: серверные копии убираем, offline-only (ещё без backendId) — оставляем
  if (apiPlayers.length === 0) {
    return locals.filter(
      (p) =>
        p.backendId == null &&
        !p.id.startsWith('player_backend_') &&
        Boolean(p.name?.trim())
    );
  }

  const apiIds = new Set(apiPlayers.map((p) => p.id));
  const usedLocalIds = new Set<string>();
  const result: Player[] = [];

  for (const apiPlayer of apiPlayers) {
    const apiName = apiPlayer.name?.trim().toLowerCase();
    const byBackend = locals.find((p) => p.backendId === apiPlayer.id);
    const byName =
      !byBackend && apiName
        ? locals.find(
            (p) =>
              !usedLocalIds.has(p.id) &&
              p.name?.trim().toLowerCase() === apiName
          )
        : undefined;
    const existing = byBackend || byName;

    if (existing) {
      usedLocalIds.add(existing.id);
      result.push({
        ...existing,
        backendId: apiPlayer.id,
        name: apiPlayer.name,
        tags: mapApiTags(apiPlayer.tags),
      });
    } else {
      result.push(mapApiPlayerToLocal(apiPlayer));
    }
  }

  // Offline-create, ещё не на сервере
  for (const local of locals) {
    if (usedLocalIds.has(local.id)) continue;
    if (local.backendId != null) {
      // Был на сервере, в ответе нет — удалён
      if (!apiIds.has(local.backendId)) continue;
    }
    if (local.id.startsWith('player_backend_')) continue;
    if (!local.name?.trim()) continue;
    const nameTaken = result.some(
      (p) =>
        p.name?.trim().toLowerCase() === local.name!.trim().toLowerCase()
    );
    if (nameTaken) continue;
    result.push(local);
  }

  return result;
};

/** Перенос заметок на актуальные id после sync (не терять history Ивана). */
const rematerializeNotesForPlayers = (
  prevPlayers: Player[],
  nextPlayers: Player[],
  notesMap: Record<string, Note[]>
): Record<string, Note[]> => {
  const nextNotes: Record<string, Note[]> = {};

  for (const next of nextPlayers) {
    const name = next.name?.trim().toLowerCase();
    const sourceIds = new Set<string>([next.id]);
    if (next.backendId != null) {
      sourceIds.add(`player_backend_${next.backendId}`);
    }
    for (const prev of prevPlayers) {
      if (next.backendId != null && prev.backendId === next.backendId) {
        sourceIds.add(prev.id);
      }
      if (name && prev.name?.trim().toLowerCase() === name) {
        sourceIds.add(prev.id);
        if (prev.backendId != null) {
          sourceIds.add(`player_backend_${prev.backendId}`);
        }
      }
    }

    const byKey = new Map<string, Note>();
    for (const id of sourceIds) {
      for (const note of notesMap[id] ?? []) {
        const key =
          note.backendId != null ? `b:${note.backendId}` : `l:${note.id}`;
        const prevNote = byKey.get(key);
        if (
          !prevNote ||
          Date.parse(note.createdAt) >= Date.parse(prevNote.createdAt || '0')
        ) {
          byKey.set(key, note);
        }
      }
    }
    const merged = [...byKey.values()].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
    );
    if (merged.length === 0) continue;

    nextNotes[next.id] = merged.map((n) => ({ ...n, playerId: next.id }));
    if (next.backendId != null) {
      const backendKey = `player_backend_${next.backendId}`;
      nextNotes[backendKey] = merged.map((n) => ({
        ...n,
        playerId: backendKey,
      }));
    }
  }

  return nextNotes;
};

const isStalePlayerReferenceError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false;
  }
  const apiError = error as ApiError;
  if (apiError.status === 404) {
    return true;
  }
  if (apiError.status === 422) {
    const detail = formatApiDetail(apiError.detail) ?? apiError.message;
    return /player/i.test(detail);
  }
  if (apiError.status >= 500) {
    const detail = formatApiDetail(apiError.detail) ?? apiError.message;
    return /player|foreign key|fk_notes_player/i.test(detail);
  }
  return false;
};

const isNetworkError = (error: unknown): boolean => {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const apiError = error as ApiError;
    // 4xx/5xx с status — не «офлайн»
    if (typeof apiError.status === 'number' && apiError.status >= 400) {
      return false;
    }
  }
  if (error instanceof TypeError) {
    // fetch без сети на RN/Chrome: TypeError: Network request failed / Failed to fetch
    return true;
  }
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes('Network') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Request failed after retries') ||
      msg.includes('timed out') ||
      msg.includes('ECONNREFUSED')
    );
  }
  return false;
};

const patchPlayerInState = (localPlayerId: string, patch: Partial<Player>) => {
  currentState = {
    ...currentState,
    allPlayers: currentState.allPlayers.map((p) =>
      p.id === localPlayerId ? { ...p, ...patch } : p
    ),
    seats: currentState.seats.map((seat) =>
      seat.id === localPlayerId ? { ...seat, ...patch } : seat
    ),
  };
};

/** Все id одного человека (локальный + player_backend_N + дубли по имени) */
const relatedPlayerIds = (playerId: string, displayName?: string): string[] => {
  const ids = new Set<string>([playerId]);
  const player = currentState.allPlayers.find((p) => p.id === playerId);
  const name = (displayName ?? player?.name)?.trim().toLowerCase();
  const backendId = player?.backendId ?? null;

  if (backendId != null) {
    ids.add(`player_backend_${backendId}`);
  }

  for (const p of currentState.allPlayers) {
    if (backendId != null && p.backendId === backendId) {
      ids.add(p.id);
    }
    if (name && p.name?.trim().toLowerCase() === name) {
      ids.add(p.id);
      if (p.backendId != null) {
        ids.add(`player_backend_${p.backendId}`);
      }
    }
  }

  return [...ids];
};

const mergeNotesAcrossIds = (playerIds: string[]): Note[] => {
  const byKey = new Map<string, Note>();
  for (const id of playerIds) {
    for (const note of currentState.notesByPlayerId[id] ?? []) {
      const key =
        note.backendId != null ? `b:${note.backendId}` : `l:${note.id}`;
      const prev = byKey.get(key);
      if (
        !prev ||
        Date.parse(note.createdAt) >= Date.parse(prev.createdAt || '0')
      ) {
        byKey.set(key, note);
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
};

const writeNotesToRelatedIds = (playerId: string, notes: Note[], displayName?: string) => {
  const targets = relatedPlayerIds(playerId, displayName);
  const nextMap = { ...currentState.notesByPlayerId };
  for (const id of targets) {
    nextMap[id] = notes.map((n) => ({ ...n, playerId: id }));
  }
  currentState = {
    ...currentState,
    notesByPlayerId: nextMap,
  };
};

const isNotFoundApiError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as ApiError).status === 404;

/** Убрать pending create/update игрока и заметки к нему — иначе delete ломает очередь. */
const dropPendingOpsForHiddenPlayer = async (
  relatedIds: string[],
  backendIds: number[]
): Promise<void> => {
  const idSet = new Set(relatedIds);
  const backendSet = new Set(backendIds);
  const ops = syncQueue.getAll();

  for (const op of ops) {
    if (op.entity === 'player') {
      const localId =
        typeof op.data?.localPlayerId === 'string'
          ? op.data.localPlayerId
          : op.entityId;
      if (op.type === 'create' && idSet.has(localId)) {
        await syncQueue.remove(op.id);
        continue;
      }
      if (
        (op.type === 'update' || op.type === 'delete') &&
        backendSet.has(Number(op.entityId))
      ) {
        await syncQueue.remove(op.id);
      }
      continue;
    }

    if (op.entity === 'note') {
      const localPlayerId = op.data?.localPlayerId;
      const playerId = op.data?.player_id;
      if (
        (typeof localPlayerId === 'string' && idSet.has(localPlayerId)) ||
        (typeof playerId === 'number' && backendSet.has(playerId))
      ) {
        await syncQueue.remove(op.id);
      }
    }
  }
};

const applyOptimisticHide = (
  relatedIds: string[],
  notesSlice: Record<string, Note[]>
): void => {
  const idSet = new Set(relatedIds);
  const nextNotes = { ...currentState.notesByPlayerId };
  for (const id of relatedIds) {
    delete nextNotes[id];
  }
  // на всякий — ключи из snapshot
  for (const id of Object.keys(notesSlice)) {
    delete nextNotes[id];
  }

  currentState = {
    ...currentState,
    allPlayers: currentState.allPlayers.filter((p) => !idSet.has(p.id)),
    seats: currentState.seats.map((seat) =>
      idSet.has(seat.id)
        ? {
            ...seat,
            id: `p${seat.seat || 1}`,
            name: undefined,
            tags: [],
            backendId: null,
          }
        : seat
    ),
    notesByPlayerId: nextNotes,
    selectedPlayerId:
      currentState.selectedPlayerId && idSet.has(currentState.selectedPlayerId)
        ? null
        : currentState.selectedPlayerId,
  };
  notifySubscribers();
};

const flushPendingHide = async (token: string): Promise<void> => {
  const pending = pendingHides.get(token);
  if (!pending || pending.flushed) {
    return;
  }
  pending.flushed = true;
  clearTimeout(pending.timer);
  pendingHides.delete(token);

  await dropPendingOpsForHiddenPlayer(pending.relatedIds, pending.backendIds);

  // Только локальный create — серверного профиля нет
  if (pending.backendIds.length === 0) {
    logger.logEvent('player_hide_local_only', { token });
    return;
  }

  for (const backendId of pending.backendIds) {
    await syncQueue.dropStaleForEntity('player', String(backendId));

    const tryOnline =
      Boolean(apiClient.getAccessToken()) &&
      isDeviceOnline(await NetInfo.fetch());

    if (tryOnline) {
      try {
        await playersApi.deletePlayer(backendId);
        continue;
      } catch (error) {
        if (isNotFoundApiError(error)) {
          // уже скрыт — no-op
          continue;
        }
        if (!isNetworkError(error)) {
          console.warn('hidePlayer API failed, queueing:', error);
        }
      }
    }

    await syncQueue.add({
      type: 'delete',
      entity: 'player',
      entityId: String(backendId),
    });
  }

  logger.logEvent('player_hide_flushed', {
    token,
    backendIds: pending.backendIds,
  });
};

const resolvePlayerBackendId = async (player: Player): Promise<number | null> => {
  if (player.backendId != null) {
    return player.backendId;
  }

  const name = player.name?.trim();
  if (!name || name.length < 2) {
    return null;
  }

  const apiPayload = {
    name,
    tags: (player.tags ?? []).map((tag) => tag.toString()),
    content: '',
  };

  try {
    const backendPlayer = await playersApi.createPlayer(apiPayload);
    patchPlayerInState(player.id, { backendId: backendPlayer.id });
    await tableStore.savePlayersToStorage();
    return backendPlayer.id;
  } catch (error) {
    if (isNetworkError(error)) {
      await syncQueue.add({
        type: 'create',
        entity: 'player',
        entityId: player.id,
        data: { ...apiPayload, localPlayerId: player.id },
      });
    }
    return null;
  }
};

export const tableStore: TableStore = {
  get tableId() {
    return currentState.tableId;
  },
  get seats() {
    return currentState.seats;
  },
  get selectedPlayerId() {
    return currentState.selectedPlayerId;
  },
  get notesByPlayerId() {
    return currentState.notesByPlayerId;
  },
  get allPlayers() {
    return currentState.allPlayers;
  },

  selectPlayer: (playerId: string | null) => {
    currentState = { ...currentState, selectedPlayerId: playerId };
    notifySubscribers();
  },

  upsertNote: (playerId: string, partial: { text?: string; tags?: string[]; backendId?: number | null }) => {
    const player = currentState.allPlayers.find((p) => p.id === playerId);
    const related = relatedPlayerIds(playerId, player?.name);
    const merged = mergeNotesAcrossIds(related);
    const now = new Date().toISOString();
    const last = merged[merged.length - 1];

    const next: Note = last
      ? {
          ...last,
          text: partial.text ?? last.text,
          tags: partial.tags ?? last.tags,
          backendId:
            partial.backendId !== undefined ? partial.backendId : last.backendId,
          createdAt: now,
          playerId,
        }
      : {
          id: `n_${playerId}_${now}`,
          backendId: partial.backendId ?? null,
          playerId,
          text: partial.text ?? '',
          createdAt: now,
          tags: partial.tags ?? [],
        };

    writeNotesToRelatedIds(playerId, [...merged.slice(0, -1), next], player?.name);
    notifySubscribers();
    void tableStore.saveNotesToStorage();
  },

  /** Новая заметка (create) — не затирает предыдущие */
  appendNote: (
    playerId: string,
    note: { text: string; tags: string[]; backendId?: number | null }
  ) => {
    const player = currentState.allPlayers.find((p) => p.id === playerId);
    const merged = mergeNotesAcrossIds(relatedPlayerIds(playerId, player?.name));
    const now = new Date().toISOString();
    const next: Note = {
      id: `n_${playerId}_${now}`,
      backendId: note.backendId ?? null,
      playerId,
      text: note.text,
      createdAt: now,
      tags: note.tags,
    };
    writeNotesToRelatedIds(playerId, [...merged, next], player?.name);
    notifySubscribers();
    void tableStore.saveNotesToStorage();
  },

  saveNote: async (
    playerId: string,
    payload: { text: string; tags: string[] }
  ): Promise<{ synced: boolean }> => {
    const trimmed = payload.text.trim();
    const player = tableStore.getPlayer(playerId);
    let backendId: number | null = player?.backendId ?? null;

    const queueLocalNote = async (apiPayload: {
      text: string;
      tags: string[];
      note_type: 'general';
      player_id?: number;
    }) => {
      await syncQueue.add({
        type: 'create',
        entity: 'note',
        entityId: `note_${Date.now()}_${playerId}`,
        data: { ...apiPayload, localPlayerId: playerId },
      });
      tableStore.appendNote(playerId, { text: trimmed, tags: payload.tags });
      return { synced: false as const };
    };

    // Airplane — сразу в очередь, без ретраев fetch
    const net = await NetInfo.fetch();
    if (!isDeviceOnline(net)) {
      const offlinePayload = {
        text: trimmed,
        tags: payload.tags,
        note_type: 'general' as const,
        ...(backendId != null ? { player_id: backendId } : {}),
      };
      return queueLocalNote(offlinePayload);
    }

    if (player && backendId == null) {
      // Не висим бесконечно, если create player тормозит/Airplane lag
      backendId = await Promise.race([
        resolvePlayerBackendId(player),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
    }

    const apiPayload = {
      text: trimmed,
      tags: payload.tags,
      note_type: 'general' as const,
      ...(backendId != null ? { player_id: backendId } : {}),
    };

    try {
      const createPromise = notesApi.createNote(apiPayload);
      const createdOrTimeout = await Promise.race([
        createPromise.then((created) => ({ ok: true as const, created })),
        new Promise<{ ok: false }>((resolve) =>
          setTimeout(() => resolve({ ok: false }), 8000)
        ),
      ]);

      if (!createdOrTimeout.ok) {
        void createPromise.catch(() => undefined);
        return queueLocalNote(apiPayload);
      }

      const created = createdOrTimeout.created;
      tableStore.appendNote(playerId, {
        text: created.text ?? trimmed,
        tags: created.tags ?? payload.tags,
        backendId: created.id,
      });
      return { synced: true };
    } catch (error) {
      if (
        player &&
        backendId != null &&
        (isStalePlayerReferenceError(error) ||
          (typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            (error as ApiError).status >= 500))
      ) {
        patchPlayerInState(playerId, { backendId: null });
        await tableStore.savePlayersToStorage();
        const refreshedPlayer = tableStore.getPlayer(playerId);
        const newBackendId = refreshedPlayer
          ? await resolvePlayerBackendId({ ...refreshedPlayer, backendId: null })
          : null;
        const retryPayload = {
          text: trimmed,
          tags: payload.tags,
          note_type: 'general' as const,
          ...(newBackendId != null ? { player_id: newBackendId } : {}),
        };
        try {
          const created = await notesApi.createNote(retryPayload);
          tableStore.appendNote(playerId, {
            text: created.text ?? trimmed,
            tags: created.tags ?? payload.tags,
            backendId: created.id,
          });
          return { synced: true };
        } catch (retryError) {
          if (isNetworkError(retryError)) {
            return queueLocalNote(retryPayload);
          }
          throw retryError;
        }
      }

      if (isNetworkError(error)) {
        return queueLocalNote(apiPayload);
      }
      throw error;
    }
  },

  loadLastNoteFromApi: async (playerId: string): Promise<void> => {
    const player = tableStore.getPlayer(playerId);
    const localNote = tableStore.getLastNote(playerId);

    if (player?.backendId == null) {
      return;
    }

    try {
      // Тянем несколько последних — UI и бейдж видят историю
      const response = await notesApi.getNotes({
        player_id: player.backendId,
        limit: 20,
        offset: 0,
      });
      if (!response.items.length) {
        return;
      }

      const latest = response.items[0];
      if (localNote?.createdAt) {
        const localTs = Date.parse(localNote.createdAt);
        const apiTs = Date.parse(latest.created_at);
        if (
          !Number.isNaN(localTs) &&
          !Number.isNaN(apiTs) &&
          localTs > apiTs &&
          localNote.text.trim()
        ) {
          return;
        }
      }

      const fromApi: Note[] = [...response.items]
        .reverse()
        .map((item) => ({
          id: `note_backend_${item.id}`,
          backendId: item.id,
          playerId,
          text: item.text,
          tags: item.tags ?? [],
          createdAt: item.created_at,
        }));

      const related = relatedPlayerIds(playerId, player.name);
      const merged = mergeNotesAcrossIds(related);
      const byBackend = new Map(
        merged
          .filter((n) => n.backendId != null)
          .map((n) => [n.backendId as number, n])
      );
      for (const note of fromApi) {
        if (note.backendId != null) {
          byBackend.set(note.backendId, note);
        }
      }
      const localsOnly = merged.filter((n) => n.backendId == null);
      const next = [...localsOnly, ...byBackend.values()].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
      );

      writeNotesToRelatedIds(playerId, next, player.name);
      notifySubscribers();
      void tableStore.saveNotesToStorage();
    } catch (error) {
      if (isNetworkError(error)) {
        return;
      }
      console.warn('Не удалось загрузить заметку из API:', error);
    }
  },

  getLastNote: (playerId: string): Note | null => {
    const player = currentState.allPlayers.find((p) => p.id === playerId);
    const notes = mergeNotesAcrossIds(relatedPlayerIds(playerId, player?.name));
    return notes[notes.length - 1] || null;
  },

  getNoteCount: (playerId: string): number => {
    const player = currentState.allPlayers.find((p) => p.id === playerId);
    return mergeNotesAcrossIds(relatedPlayerIds(playerId, player?.name)).length;
  },

  createPlayer: async (name: string, tags: Tag[], seatIndex?: number): Promise<Player> => {
    const normalizedTags = tags
      .map((t) => normalizePlayerTagCode(String(t)))
      .filter((t) => t !== 'unknown')
      .slice(0, 1) as Tag[];

    const newPlayer: Player = {
      id: generatePlayerId(),
      backendId: null,
      tableId: currentState.tableId,
      seat: seatIndex !== undefined ? seatIndex + 1 : 0,
      name,
      tags: normalizedTags,
      createdAt: new Date().toISOString(),
    };

    logPlayerCreate(name, normalizedTags.map((tag) => tag.toString()), seatIndex);

    currentState = {
      ...currentState,
      allPlayers: [...currentState.allPlayers, newPlayer],
    };

    if (seatIndex !== undefined) {
      currentState = {
        ...currentState,
        seats: currentState.seats.map((seat, index) =>
          index === seatIndex ? { ...seat, ...newPlayer } : seat
        ),
      };
    }

    notifySubscribers();
    await tableStore.savePlayersToStorage();

    const apiPayload = {
      name,
      tags: normalizedTags.map((tag) => tag.toString()),
      content: '',
    };

    const queueOffline = async () => {
      await syncQueue.add({
        type: 'create',
        entity: 'player',
        entityId: newPlayer.id,
        data: { ...apiPayload, localPlayerId: newPlayer.id },
      });
      logger.logEvent('player_create_queued_offline', { playerId: newPlayer.id });
    };

    try {
      const net = await NetInfo.fetch();
      if (!isDeviceOnline(net)) {
        await queueOffline();
        return newPlayer;
      }
    } catch {
      await queueOffline();
      return newPlayer;
    }

    // Онлайн: ждём API коротко; при зависании (Airplane lag) — место уже занято локально
    const apiPromise = playersApi.createPlayer(apiPayload);
    type RaceOk = { ok: true; backend: Awaited<typeof apiPromise> };
    type RaceSlow = { ok: false };
    const raced = await Promise.race([
      apiPromise
        .then((backend): RaceOk => ({ ok: true, backend }))
        .catch((): RaceSlow => ({ ok: false })),
      new Promise<RaceSlow>((resolve) =>
        setTimeout(() => resolve({ ok: false }), 2500)
      ),
    ]);

    if (raced.ok) {
      patchPlayerInState(newPlayer.id, { backendId: raced.backend.id });
      notifySubscribers();
      await tableStore.savePlayersToStorage();
      return { ...newPlayer, backendId: raced.backend.id };
    }

    void apiPromise
      .then(async (backend) => {
        patchPlayerInState(newPlayer.id, { backendId: backend.id });
        notifySubscribers();
        await tableStore.savePlayersToStorage();
      })
      .catch(async (error) => {
        if (isNetworkError(error)) {
          await queueOffline();
          return;
        }
        console.warn('Player saved locally, API rejected:', error);
      });

    return newPlayer;
  },

  listPlayers: (query?: string): Player[] => {
    let players = currentState.allPlayers;

    if (query?.trim()) {
      const searchQuery = query.toLowerCase().trim();
      players = players.filter((player) =>
        player.name?.toLowerCase().includes(searchQuery)
      );
    }

    return players;
  },

  assignSeat: (seatIndex: number, playerId: string): void => {
    const player = currentState.allPlayers.find((p) => p.id === playerId);
    if (!player) {
      return;
    }

    const updatedPlayer = { ...player, seat: seatIndex + 1 };

    currentState = {
      ...currentState,
      seats: currentState.seats.map((seat, index) =>
        index === seatIndex ? updatedPlayer : seat
      ),
      allPlayers: currentState.allPlayers.map((p) =>
        p.id === playerId ? updatedPlayer : p
      ),
    };

    notifySubscribers();
  },

  getPlayer: (playerId: string): Player | null =>
    currentState.allPlayers.find((p) => p.id === playerId) || null,

  applyBackendId: (localPlayerId: string, backendId: number): void => {
    patchPlayerInState(localPlayerId, { backendId });
    notifySubscribers();
    void tableStore.savePlayersToStorage();
  },

  setPlayerTag: async (playerId: string, tagCode: string): Promise<void> => {
    const code = normalizePlayerTagCode(tagCode);
    const tags = (code === 'unknown' ? [] : [code]) as Tag[];
    const ids = relatedPlayerIds(playerId);

    currentState = {
      ...currentState,
      allPlayers: currentState.allPlayers.map((p) =>
        ids.includes(p.id) ? { ...p, tags } : p
      ),
      seats: currentState.seats.map((seat) =>
        ids.includes(seat.id) ? { ...seat, tags } : seat
      ),
    };
    notifySubscribers();
    await tableStore.savePlayersToStorage();

    const player = currentState.allPlayers.find((p) => ids.includes(p.id) && p.backendId != null);
    const backendId = player?.backendId ?? null;
    const payload = { tags: tags.map((t) => String(t)) };

    if (backendId == null) {
      return;
    }

    try {
      const net = await NetInfo.fetch();
      if (!isDeviceOnline(net)) {
        await syncQueue.add({
          type: 'update',
          entity: 'player',
          entityId: String(backendId),
          data: payload,
        });
        return;
      }
      await playersApi.updatePlayer(backendId, payload);
    } catch (error) {
      if (isNetworkError(error)) {
        await syncQueue.add({
          type: 'update',
          entity: 'player',
          entityId: String(backendId),
          data: payload,
        });
        return;
      }
      console.warn('setPlayerTag API failed:', error);
    }
  },

  renamePlayer: async (playerId: string, name: string): Promise<void> => {
    const nextName = name.trim();
    const ids = relatedPlayerIds(playerId);

    currentState = {
      ...currentState,
      allPlayers: currentState.allPlayers.map((p) =>
        ids.includes(p.id) ? { ...p, name: nextName || undefined } : p
      ),
      seats: currentState.seats.map((seat) =>
        ids.includes(seat.id) ? { ...seat, name: nextName || undefined } : seat
      ),
    };
    notifySubscribers();
    await tableStore.savePlayersToStorage();

    const local = currentState.allPlayers.find((p) => ids.includes(p.id));
    let backendId = local?.backendId ?? null;
    let createdOnRename = false;

    // Безымянный часто без backendId — при первом имени создаём профиль на API
    if (backendId == null && nextName.length >= 2 && local) {
      backendId = await resolvePlayerBackendId({ ...local, name: nextName });
      createdOnRename = backendId != null;
    }

    if (backendId == null || createdOnRename) {
      return;
    }

    const payload = { name: nextName };
    try {
      const net = await NetInfo.fetch();
      if (!isDeviceOnline(net)) {
        await syncQueue.add({
          type: 'update',
          entity: 'player',
          entityId: String(backendId),
          data: payload,
        });
        return;
      }
      await playersApi.updatePlayer(backendId, payload);
    } catch (error) {
      if (isNetworkError(error)) {
        await syncQueue.add({
          type: 'update',
          entity: 'player',
          entityId: String(backendId),
          data: payload,
        });
        return;
      }
      console.warn('renamePlayer API failed:', error);
    }
  },

  hidePlayer: async (playerId: string): Promise<HidePlayerResult | null> => {
    const seed = currentState.allPlayers.find((p) => p.id === playerId);
    if (!seed) {
      return null;
    }

    const relatedIds = relatedPlayerIds(playerId, seed.name);
    const idSet = new Set(relatedIds);
    const players = currentState.allPlayers.filter((p) => idSet.has(p.id));
    if (players.length === 0) {
      return null;
    }

    const notesSlice: Record<string, Note[]> = {};
    for (const id of relatedIds) {
      if (currentState.notesByPlayerId[id]) {
        notesSlice[id] = currentState.notesByPlayerId[id].map((n) => ({ ...n }));
      }
    }

    const backendIds = [
      ...new Set(
        players
          .map((p) => p.backendId)
          .filter((id): id is number => typeof id === 'number')
      ),
    ];

    applyOptimisticHide(relatedIds, notesSlice);
    await tableStore.savePlayersToStorage();
    await tableStore.saveNotesToStorage();

    const token = `hide_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const undoUntil = Date.now() + HIDE_PLAYER_UNDO_MS;
    const timer = setTimeout(() => {
      void flushPendingHide(token);
    }, HIDE_PLAYER_UNDO_MS);

    pendingHides.set(token, {
      token,
      relatedIds,
      players: players.map((p) => ({ ...p })),
      notesSlice,
      backendIds,
      timer,
      flushed: false,
    });

    logger.logEvent('player_hide_pending', {
      token,
      relatedIds,
      backendIds,
      undoUntil,
    });

    return { undoToken: token, undoUntil, relatedIds };
  },

  undoHidePlayer: async (undoToken: string): Promise<boolean> => {
    const pending = pendingHides.get(undoToken);
    if (!pending || pending.flushed) {
      return false;
    }
    pending.flushed = true;
    clearTimeout(pending.timer);
    pendingHides.delete(undoToken);

    const existingIds = new Set(currentState.allPlayers.map((p) => p.id));
    const restoredPlayers = pending.players.filter((p) => !existingIds.has(p.id));
    const nextNotes = { ...currentState.notesByPlayerId, ...pending.notesSlice };

    currentState = {
      ...currentState,
      allPlayers: [...currentState.allPlayers, ...restoredPlayers],
      notesByPlayerId: nextNotes,
    };
    notifySubscribers();
    await tableStore.savePlayersToStorage();
    await tableStore.saveNotesToStorage();

    logger.logEvent('player_hide_undone', { token: undoToken });
    return true;
  },

  syncPlayersFromApi: async (): Promise<void> => {
    try {
      const response = await playersApi.getPlayers(undefined, undefined, 100, 0);
      const prevPlayers = currentState.allPlayers;
      const prevNotes = currentState.notesByPlayerId;
      const nextPlayers = mergeApiPlayers(prevPlayers, response.items);
      const nextNotes = rematerializeNotesForPlayers(
        prevPlayers,
        nextPlayers,
        prevNotes
      );

      currentState = {
        ...currentState,
        allPlayers: nextPlayers,
        notesByPlayerId: nextNotes,
      };
      notifySubscribers();
      await tableStore.savePlayersToStorage();
      await tableStore.saveNotesToStorage();
    } catch (error) {
      if (isNetworkError(error)) {
        return;
      }
      console.warn('Не удалось загрузить игроков из API:', error);
    }
  },

  loadPlayersFromStorage: async (): Promise<void> => {
    try {
      const storedPlayers = await AsyncStorage.getItem(PLAYERS_STORAGE_KEY);
      if (storedPlayers) {
        const players: Player[] = JSON.parse(storedPlayers).map(normalizeStoredPlayer);
        currentState = {
          ...currentState,
          allPlayers: players,
        };
        notifySubscribers();
      }
    } catch (error) {
      console.error('Ошибка загрузки игроков из хранилища:', error);
    }
  },

  savePlayersToStorage: async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        PLAYERS_STORAGE_KEY,
        JSON.stringify(currentState.allPlayers)
      );
    } catch (error) {
      console.error('Ошибка сохранения игроков в хранилище:', error);
    }
  },

  loadNotesFromStorage: async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored) as Record<string, Note[]>;
      currentState = {
        ...currentState,
        notesByPlayerId: parsed,
      };
      notifySubscribers();
    } catch (error) {
      console.error('Ошибка загрузки заметок из хранилища:', error);
    }
  },

  saveNotesToStorage: async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        NOTES_STORAGE_KEY,
        JSON.stringify(currentState.notesByPlayerId)
      );
    } catch (error) {
      console.error('Ошибка сохранения заметок в хранилище:', error);
    }
  },

  ensurePlayerForQuickNote: (
    seatPlayerId: string,
    displayName?: string,
    seatIndex?: number
  ): string => {
    const resolvedId = tableStore.resolvePlayerIdForNotes(seatPlayerId, displayName);
    if (currentState.allPlayers.some((p) => p.id === resolvedId)) {
      return resolvedId;
    }

    const stub: Player = {
      id: seatPlayerId,
      backendId: null,
      tableId: currentState.tableId,
      seat: seatIndex !== undefined ? seatIndex + 1 : 0,
      name: displayName?.trim() || undefined,
      tags: [],
      createdAt: new Date().toISOString(),
    };

    currentState = {
      ...currentState,
      allPlayers: [...currentState.allPlayers, stub],
    };
    notifySubscribers();
    void tableStore.savePlayersToStorage();
    return seatPlayerId;
  },

  resolvePlayerIdForNotes: (seatPlayerId: string, displayName?: string): string => {
    const normalizedName = displayName?.trim().toLowerCase();
    if (normalizedName) {
      const byName = currentState.allPlayers.filter(
        (p) => p.name?.trim().toLowerCase() === normalizedName
      );
      if (byName.length > 0) {
        const withNotes = byName
          .map((p) => ({
            p,
            count: mergeNotesAcrossIds(relatedPlayerIds(p.id, p.name)).length,
          }))
          .filter((x) => x.count > 0)
          .sort((a, b) => {
            // сначала с backendId (реальный профиль), потом по числу заметок
            const aLinked = a.p.backendId != null ? 1 : 0;
            const bLinked = b.p.backendId != null ? 1 : 0;
            if (bLinked !== aLinked) {
              return bLinked - aLinked;
            }
            return b.count - a.count;
          });
        if (withNotes.length > 0) {
          return withNotes[0].p.id;
        }
        const localLinked = byName.find(
          (p) => p.backendId != null && !p.id.startsWith('player_backend_')
        );
        if (localLinked) {
          return localLinked.id;
        }
        const withBackend = byName.find((p) => p.backendId != null);
        return (withBackend ?? byName[0]).id;
      }
    }

    if (currentState.allPlayers.some((p) => p.id === seatPlayerId)) {
      return seatPlayerId;
    }

    return seatPlayerId;
  },

  resetState: (): void => {
    for (const pending of pendingHides.values()) {
      clearTimeout(pending.timer);
    }
    pendingHides.clear();
    currentState = {
      tableId: 'demo',
      seats: initialSeats,
      selectedPlayerId: null,
      notesByPlayerId: {},
      allPlayers: [],
    };
    notifySubscribers();
  },

  clearLocalTableData: async (): Promise<void> => {
    tableStore.resetState();
    try {
      const keys = await AsyncStorage.getAllKeys();
      // seats хранятся как @apn:speed_focus_seats_v1:<tableId> — старый ключ без суффикса тоже подчистим
      const seatKeys = keys.filter(
        (k) =>
          k === '@apn:speed_focus_seats_v1' ||
          k.startsWith('@apn:speed_focus_seats_v1:')
      );
      await AsyncStorage.multiRemove([
        PLAYERS_STORAGE_KEY,
        NOTES_STORAGE_KEY,
        '@apn:sync_queue',
        ...seatKeys,
      ]);
    } catch (error) {
      console.warn('Не удалось очистить локальные данные стола:', error);
    }
  },
};

export const subscribe = (callback: () => void) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

export const useTableStore = () => {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => subscribe(forceUpdate), []);

  return tableStore;
};
