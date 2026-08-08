/**
 * @file: tables.ts (store)
 * @description: Список сохранённых столов — CRUD, кэш, offline queue
 * @dependencies: tablesApi, syncQueue, AsyncStorage
 * @created: 2026-07-18
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  tablesApi,
  Table,
  TableCreate,
} from '../services/api/tablesApi';
import { syncQueue } from '../services/sync/syncQueue';
import { apiClient } from '../services/api/client';

const CACHE_KEY = '@apn:tables_v1';

export type SavedTable = {
  id: number | string;
  name: string;
  size: number;
  hero_position?: number | null;
  location?: string | null;
  limits?: string | null;
  created_at?: string;
  updated_at?: string;
};

type TablesState = {
  items: SavedTable[];
  loaded: boolean;
};

let currentState: TablesState = {
  items: [],
  loaded: false,
};

/** local_t… → backend id после sync create */
const idAliases: Record<string, string> = {};

const subscribers = new Set<() => void>();

function emit() {
  subscribers.forEach((cb) => cb());
}

function setState(partial: Partial<TablesState>) {
  currentState = { ...currentState, ...partial };
  emit();
}

async function persistCache(items: SavedTable[]) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function isOnlineEnough(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function canHitApi() {
  return Boolean(apiClient.getAccessToken());
}

export function mapApiTable(t: Table): SavedTable {
  return {
    id: t.id,
    name: t.name,
    size: t.size,
    hero_position: t.hero_position,
    location: t.location,
    limits: t.limits,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

export const DEMO_TABLE_IDS = new Set([
  'sc1',
  'abc123',
  'def456',
  'ghi789',
]);

export function isDemoTableId(tableId: string): boolean {
  return DEMO_TABLE_IDS.has(tableId);
}

export const tablesStore = {
  getState: () => currentState,

  subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },

  getById(id: string | number): SavedTable | null {
    const key = String(id);
    const aliased = idAliases[key];
    return (
      currentState.items.find(
        (t) => String(t.id) === key || (aliased != null && String(t.id) === aliased)
      ) ?? null
    );
  },

  isSaved(tableId: string): boolean {
    return Boolean(this.getById(tableId));
  },

  canDelete(tableId: string): boolean {
    if (isDemoTableId(tableId)) return false;
    return this.isSaved(tableId);
  },

  async hydrate(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedTable[];
        if (Array.isArray(parsed)) {
          setState({ items: parsed, loaded: true });
          return;
        }
      }
    } catch {
      // empty
    }
    setState({ items: [], loaded: true });
  },

  async refreshFromApi(): Promise<void> {
    if (!canHitApi()) return;
    try {
      const res = await tablesApi.getTables(100, 0);
      const next = (res.items ?? []).map(mapApiTable);
      setState({ items: next, loaded: true });
      await persistCache(next);
    } catch {
      // офлайн — кэш
    }
  },

  applyBackendId(localId: string, created: Table) {
    const mapped = mapApiTable(created);
    idAliases[localId] = String(created.id);
    const next = currentState.items.map((t) =>
      String(t.id) === localId ? mapped : t
    );
    setState({ items: next });
    void persistCache(next);

    // перенос локальной рассадки на backend id
    const oldKey = `@apn:speed_focus_seats_v1:${localId}`;
    const newKey = `@apn:speed_focus_seats_v1:${created.id}`;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(oldKey);
        if (raw) {
          await AsyncStorage.setItem(newKey, raw);
          await AsyncStorage.removeItem(oldKey);
        }
      } catch {
        // ignore
      }
    })();
  },

  async create(input: TableCreate): Promise<SavedTable> {
    const localId = `local_t${Date.now().toString(36)}`;
    const optimistic: SavedTable = {
      id: localId,
      name: input.name,
      size: input.size,
      hero_position: input.hero_position ?? null,
      location: input.location ?? null,
      limits: input.limits ?? null,
      created_at: new Date().toISOString(),
    };
    const next = [optimistic, ...currentState.items];
    setState({ items: next });
    await persistCache(next);

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        const created = await tablesApi.createTable(input);
        const mapped = mapApiTable(created);
        const replaced = currentState.items.map((t) =>
          String(t.id) === localId ? mapped : t
        );
        setState({ items: replaced });
        await persistCache(replaced);
        return mapped;
      } catch {
        // queue ниже
      }
    }

    await syncQueue.add({
      type: 'create',
      entity: 'table',
      entityId: localId,
      data: { ...input, localTableId: localId },
    });
    return optimistic;
  },

  async remove(tableId: string | number): Promise<void> {
    const key = String(tableId);
    const row = this.getById(key);
    if (!row) return;

    const removeKey = String(row.id);
    const next = currentState.items.filter((t) => String(t.id) !== removeKey);
    setState({ items: next });
    await persistCache(next);

    // локальный ещё не на сервере — уберём create из очереди
    if (typeof row.id === 'string' || String(row.id).startsWith('local_')) {
      const queue = syncQueue.getAll();
      for (const op of queue) {
        if (
          op.entity === 'table' &&
          op.type === 'create' &&
          (op.entityId === removeKey ||
            op.entityId === key ||
            op.data?.localTableId === removeKey ||
            op.data?.localTableId === key)
        ) {
          await syncQueue.remove(op.id);
        }
      }
      return;
    }

    const backendId = Number(removeKey);
    if (Number.isNaN(backendId)) return;

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        await tablesApi.deleteTable(backendId);
        return;
      } catch {
        // queue
      }
    }

    await syncQueue.dropStaleForEntity('table', removeKey);
    await syncQueue.add({
      type: 'delete',
      entity: 'table',
      entityId: removeKey,
    });
  },
};

export function useTablesStore(): TablesState {
  return React.useSyncExternalStore(
    tablesStore.subscribe,
    tablesStore.getState,
    tablesStore.getState
  );
}
