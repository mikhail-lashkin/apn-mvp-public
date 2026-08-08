/**
 * @file: playerTags.ts (store)
 * @description: Справочник меток ColorSystem — CRUD, кэш, offline queue (SC-6)
 * @created: 2026-07-15
 * @updated: 2026-07-17
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  PLAYER_TAG_SEED,
  PlayerTagDef,
  listPlayerTagOptions,
  normalizePlayerTagCode,
} from '../constants/playerTags';
import { playerTagsApi, mapApiTagToDef } from '../services/api/playerTagsApi';
import { syncQueue } from '../services/sync/syncQueue';
import { apiClient } from '../services/api/client';

// v2: seed = Colors_to_PlayerTypes (сброс кэша старого SC-6 Tailwind seed)
const CACHE_KEY = '@apn:player_tags_v2';

type PlayerTagsState = {
  tags: PlayerTagDef[];
  loaded: boolean;
};

let currentState: PlayerTagsState = {
  tags: [...PLAYER_TAG_SEED],
  loaded: false,
};

const subscribers = new Set<() => void>();

function emit() {
  subscribers.forEach((cb) => cb());
}

function setState(partial: Partial<PlayerTagsState>) {
  currentState = { ...currentState, ...partial };
  emit();
}

async function persistCache(tags: PlayerTagDef[]) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(tags));
  } catch {
    // ignore
  }
}

function isOnlineEnough(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function canHitApi() {
  return Boolean(apiClient.getAccessToken());
}

function entityKey(tag: PlayerTagDef): string {
  if (tag.id != null) return String(tag.id);
  return tag.code;
}

function sortTags(tags: PlayerTagDef[]): PlayerTagDef[] {
  return [...tags].sort((a, b) => a.sortOrder - b.sortOrder || String(a.code).localeCompare(b.code));
}

export const playerTagsStore = {
  getState: () => currentState,

  subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },

  async hydrate(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PlayerTagDef[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setState({ tags: sortTags(parsed), loaded: true });
          return;
        }
      }
    } catch {
      // seed
    }
    setState({ tags: [...PLAYER_TAG_SEED], loaded: true });
  },

  async refreshFromApi(): Promise<void> {
    try {
      const res = await playerTagsApi.list();
      const next = (res.items ?? []).map(mapApiTagToDef);
      if (next.length === 0) return;
      const sorted = sortTags(next);
      setState({ tags: sorted, loaded: true });
      await persistCache(sorted);
    } catch {
      // офлайн — seed/кэш
    }
  },

  getByCode(code: string | null | undefined): PlayerTagDef | null {
    const normalized = normalizePlayerTagCode(code);
    if (normalized === 'unknown') return null;
    return currentState.tags.find((t) => t.code === normalized) ?? null;
  },

  getColor(code: string | null | undefined, fallback = '#6B7280'): string {
    return this.getByCode(code)?.color ?? fallback;
  },

  options(): { label: string; value: string; color: string }[] {
    if (!currentState.tags.length) return listPlayerTagOptions();
    return currentState.tags.map((t) => ({
      label: t.label,
      value: t.code,
      color: t.color,
    }));
  },

  applyBackendId(localId: string, backendId: number, patch?: Partial<PlayerTagDef>) {
    setState({
      tags: currentState.tags.map((t) =>
        String(t.id) === localId || t.code === localId
          ? { ...t, id: backendId, ...patch }
          : t
      ),
    });
    void persistCache(currentState.tags);
  },

  async createTag(label: string, color: string): Promise<PlayerTagDef> {
    const localId = `local_${Date.now()}`;
    const maxOrder = currentState.tags.reduce((m, t) => Math.max(m, t.sortOrder), 0);
    const optimistic: PlayerTagDef = {
      id: localId,
      code: `custom_${Date.now().toString(36)}`,
      label: label.trim(),
      color,
      sortOrder: maxOrder + 1,
      isSystem: false,
    };
    const next = sortTags([...currentState.tags, optimistic]);
    setState({ tags: next });
    await persistCache(next);

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        const created = await playerTagsApi.create({ label: optimistic.label, color });
        const mapped = mapApiTagToDef(created);
        const replaced = sortTags(
          currentState.tags.map((t) => (String(t.id) === localId ? mapped : t))
        );
        setState({ tags: replaced });
        await persistCache(replaced);
        return mapped;
      } catch {
        // queue
      }
    }

    await syncQueue.add({
      type: 'create',
      entity: 'player_tag',
      entityId: localId,
      data: { label: optimistic.label, color, localTagId: localId },
    });
    return optimistic;
  },

  async updateTag(
    idOrCode: string | number,
    patch: { label?: string; color?: string }
  ): Promise<void> {
    const key = String(idOrCode);
    const tags = currentState.tags.map((t) => {
      if (String(t.id) === key || t.code === key) {
        return {
          ...t,
          ...(patch.label != null ? { label: patch.label.trim() } : {}),
          ...(patch.color != null ? { color: patch.color } : {}),
        };
      }
      return t;
    });
    setState({ tags: sortTags(tags) });
    await persistCache(currentState.tags);

    const row = currentState.tags.find((t) => String(t.id) === key || t.code === key);
    const backendId = typeof row?.id === 'number' ? row.id : null;

    if (backendId == null) {
      // ещё не на сервере — обновим data в create-op если есть
      return;
    }

    await syncQueue.dropStaleForEntity('player_tag', String(backendId));

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        const updated = await playerTagsApi.update(backendId, {
          label: patch.label,
          color: patch.color,
        });
        const mapped = mapApiTagToDef(updated);
        setState({
          tags: sortTags(
            currentState.tags.map((t) => (t.id === backendId ? mapped : t))
          ),
        });
        await persistCache(currentState.tags);
        return;
      } catch {
        // queue
      }
    }

    await syncQueue.add({
      type: 'update',
      entity: 'player_tag',
      entityId: String(backendId),
      data: patch,
    });
  },

  async deleteTag(idOrCode: string | number): Promise<void> {
    const key = String(idOrCode);
    const row = currentState.tags.find((t) => String(t.id) === key || t.code === key);
    if (!row) return;

    const next = currentState.tags.filter((t) => String(t.id) !== key && t.code !== key);
    setState({ tags: next });
    await persistCache(next);

    const backendId = typeof row.id === 'number' ? row.id : null;
    if (backendId == null) {
      // локальный create ещё в очереди — убрать create
      const pending = syncQueue.getPending();
      for (const op of pending) {
        if (
          op.entity === 'player_tag' &&
          op.type === 'create' &&
          (op.entityId === key || op.data?.localTagId === key)
        ) {
          await syncQueue.remove(op.id);
        }
      }
      return;
    }

    await syncQueue.dropStaleForEntity('player_tag', String(backendId));

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        await playerTagsApi.delete(backendId);
        return;
      } catch {
        // queue
      }
    }

    await syncQueue.add({
      type: 'delete',
      entity: 'player_tag',
      entityId: String(backendId),
    });
  },

  async moveTag(idOrCode: string | number, direction: 'up' | 'down'): Promise<void> {
    const sorted = sortTags(currentState.tags);
    const idx = sorted.findIndex((t) => String(t.id) === String(idOrCode) || t.code === idOrCode);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapWith];
    const orderA = a.sortOrder;
    const orderB = b.sortOrder;
    const swapped = sorted.map((t, i) => {
      if (i === idx) return { ...t, sortOrder: orderB };
      if (i === swapWith) return { ...t, sortOrder: orderA };
      return t;
    });
    // если sortOrder совпадали — перенумеруем
    const renumbered = sortTags(swapped).map((t, i) => ({ ...t, sortOrder: i + 1 }));
    setState({ tags: renumbered });
    await persistCache(renumbered);

    const items = renumbered
      .filter((t) => typeof t.id === 'number')
      .map((t) => ({ id: t.id as number, sort_order: t.sortOrder }));
    if (items.length === 0) return;

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        const res = await playerTagsApi.reorder(items);
        const next = sortTags((res.items ?? []).map(mapApiTagToDef));
        setState({ tags: next });
        await persistCache(next);
        return;
      } catch {
        // queue
      }
    }

    await syncQueue.add({
      type: 'update',
      entity: 'player_tag',
      entityId: 'reorder',
      data: { items },
    });
  },
};

export function usePlayerTagsStore(): PlayerTagsState & {
  options: () => { label: string; value: string; color: string }[];
  getByCode: (code: string | null | undefined) => PlayerTagDef | null;
} {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => playerTagsStore.subscribe(bump), []);
  return {
    ...currentState,
    options: () => playerTagsStore.options(),
    getByCode: (c) => playerTagsStore.getByCode(c),
  };
}
