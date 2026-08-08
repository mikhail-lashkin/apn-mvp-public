/**
 * @file: noteTags.ts (store)
 * @description: Справочник быстрых тегов заметки — CRUD, кэш, offline queue (SC-7)
 * @created: 2026-07-18
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  NOTE_TAG_SEED,
  NoteTagDef,
  QuickNoteTagGroup,
  groupsFromDefs,
  listQuickNoteTagOptions,
} from '../constants/quickNoteTags';
import { noteTagsApi, mapApiNoteTagToDef } from '../services/api/noteTagsApi';
import { syncQueue } from '../services/sync/syncQueue';
import { apiClient } from '../services/api/client';

const CACHE_KEY = '@apn:note_tags_v1';

type NoteTagsState = {
  tags: NoteTagDef[];
  loaded: boolean;
};

let currentState: NoteTagsState = {
  tags: [...NOTE_TAG_SEED],
  loaded: false,
};

const subscribers = new Set<() => void>();

function emit() {
  subscribers.forEach((cb) => cb());
}

function setState(partial: Partial<NoteTagsState>) {
  currentState = { ...currentState, ...partial };
  emit();
}

async function persistCache(tags: NoteTagDef[]) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(tags));
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

function sortTags(tags: NoteTagDef[]): NoteTagDef[] {
  return [...tags].sort(
    (a, b) => a.sortOrder - b.sortOrder || String(a.code).localeCompare(b.code)
  );
}

export const noteTagsStore = {
  getState: () => currentState,

  subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },

  async hydrate(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as NoteTagDef[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setState({ tags: sortTags(parsed), loaded: true });
          return;
        }
      }
    } catch {
      // seed
    }
    setState({ tags: [...NOTE_TAG_SEED], loaded: true });
  },

  async refreshFromApi(): Promise<void> {
    try {
      const res = await noteTagsApi.list();
      const next = (res.items ?? []).map(mapApiNoteTagToDef);
      if (next.length === 0) return;
      const sorted = sortTags(next);
      setState({ tags: sorted, loaded: true });
      await persistCache(sorted);
    } catch {
      // офлайн
    }
  },

  groups(): QuickNoteTagGroup[] {
    if (!currentState.tags.length) {
      return groupsFromDefs(NOTE_TAG_SEED);
    }
    return groupsFromDefs(currentState.tags);
  },

  options(): { label: string; value: string }[] {
    if (!currentState.tags.length) return listQuickNoteTagOptions();
    return currentState.tags.map((t) => ({ label: t.label, value: t.code }));
  },

  applyBackendId(localId: string, backendId: number, patch?: Partial<NoteTagDef>) {
    setState({
      tags: currentState.tags.map((t) =>
        String(t.id) === localId || t.code === localId
          ? { ...t, id: backendId, ...patch }
          : t
      ),
    });
    void persistCache(currentState.tags);
  },

  async createTag(label: string, groupId: string): Promise<NoteTagDef> {
    const localId = `local_nt_${Date.now()}`;
    const maxOrder = currentState.tags.reduce((m, t) => Math.max(m, t.sortOrder), 0);
    const optimistic: NoteTagDef = {
      id: localId,
      code: `custom_${Date.now().toString(36)}`,
      label: label.trim(),
      groupId,
      sortOrder: maxOrder + 1,
      isSystem: false,
    };
    const next = sortTags([...currentState.tags, optimistic]);
    setState({ tags: next });
    await persistCache(next);

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        const created = await noteTagsApi.create({
          label: optimistic.label,
          group_id: groupId,
        });
        const mapped = mapApiNoteTagToDef(created);
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
      entity: 'note_tag',
      entityId: localId,
      data: {
        label: optimistic.label,
        group_id: groupId,
        localTagId: localId,
      },
    });
    return optimistic;
  },

  async updateTag(
    idOrCode: string | number,
    patch: { label?: string; groupId?: string }
  ): Promise<void> {
    const key = String(idOrCode);
    const tags = currentState.tags.map((t) => {
      if (String(t.id) === key || t.code === key) {
        return {
          ...t,
          ...(patch.label != null ? { label: patch.label.trim() } : {}),
          ...(patch.groupId != null ? { groupId: patch.groupId } : {}),
        };
      }
      return t;
    });
    setState({ tags: sortTags(tags) });
    await persistCache(currentState.tags);

    const row = currentState.tags.find(
      (t) => String(t.id) === key || t.code === key
    );
    const backendId = typeof row?.id === 'number' ? row.id : null;
    if (backendId == null) return;

    await syncQueue.dropStaleForEntity('note_tag', String(backendId));

    const apiPatch = {
      label: patch.label,
      group_id: patch.groupId,
    };

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        const updated = await noteTagsApi.update(backendId, apiPatch);
        const mapped = mapApiNoteTagToDef(updated);
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
      entity: 'note_tag',
      entityId: String(backendId),
      data: apiPatch,
    });
  },

  async deleteTag(idOrCode: string | number): Promise<void> {
    const key = String(idOrCode);
    const row = currentState.tags.find(
      (t) => String(t.id) === key || t.code === key
    );
    if (!row) return;

    const next = currentState.tags.filter(
      (t) => String(t.id) !== key && t.code !== key
    );
    setState({ tags: next });
    await persistCache(next);

    const backendId = typeof row.id === 'number' ? row.id : null;
    if (backendId == null) {
      const pending = syncQueue.getPending();
      for (const op of pending) {
        if (
          op.entity === 'note_tag' &&
          op.type === 'create' &&
          (op.entityId === key || op.data?.localTagId === key)
        ) {
          await syncQueue.remove(op.id);
        }
      }
      return;
    }

    await syncQueue.dropStaleForEntity('note_tag', String(backendId));

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        await noteTagsApi.delete(backendId);
        return;
      } catch {
        // queue
      }
    }

    await syncQueue.add({
      type: 'delete',
      entity: 'note_tag',
      entityId: String(backendId),
    });
  },

  async moveTag(idOrCode: string | number, direction: 'up' | 'down'): Promise<void> {
    const sorted = sortTags(currentState.tags);
    const idx = sorted.findIndex(
      (t) => String(t.id) === String(idOrCode) || t.code === idOrCode
    );
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapWith];
    const swapped = sorted.map((t, i) => {
      if (i === idx) return { ...t, sortOrder: b.sortOrder };
      if (i === swapWith) return { ...t, sortOrder: a.sortOrder };
      return t;
    });
    const renumbered = sortTags(swapped).map((t, i) => ({
      ...t,
      sortOrder: i + 1,
    }));
    setState({ tags: renumbered });
    await persistCache(renumbered);

    const items = renumbered
      .filter((t) => typeof t.id === 'number')
      .map((t) => ({ id: t.id as number, sort_order: t.sortOrder }));
    if (items.length === 0) return;

    const net = await NetInfo.fetch();
    if (isOnlineEnough(net) && canHitApi()) {
      try {
        const res = await noteTagsApi.reorder(items);
        const next = sortTags((res.items ?? []).map(mapApiNoteTagToDef));
        setState({ tags: next });
        await persistCache(next);
        return;
      } catch {
        // queue
      }
    }

    await syncQueue.add({
      type: 'update',
      entity: 'note_tag',
      entityId: 'reorder',
      data: { items },
    });
  },
};

export function useNoteTagsStore(): NoteTagsState & {
  groups: () => QuickNoteTagGroup[];
} {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => noteTagsStore.subscribe(bump), []);
  return {
    ...currentState,
    groups: () => noteTagsStore.groups(),
  };
}
