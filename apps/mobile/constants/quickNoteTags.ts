/**
 * @file: quickNoteTags.ts
 * @description: Seed быстрых тегов заметки (SC-3) + helpers; CRUD — noteTagsStore (SC-7)
 * @created: 2026-07-15
 * @updated: 2026-07-18
 */

export type QuickNoteTagOption = {
  label: string;
  value: string;
};

export type QuickNoteTagGroup = {
  id: string;
  title: string;
  options: QuickNoteTagOption[];
};

export type NoteTagDef = {
  id?: number | string;
  code: string;
  label: string;
  groupId: string;
  sortOrder: number;
  isSystem?: boolean;
};

export const NOTE_TAG_GROUP_META: { id: string; title: string }[] = [
  { id: 'preflop', title: 'Preflop' },
  { id: 'postflop', title: 'Postflop' },
  { id: 'bluff_timing', title: 'Bluff / Timing' },
  { id: 'stack', title: 'Stack' },
];

/** Offline seed = кураторский набор SC-3 */
export const NOTE_TAG_SEED: NoteTagDef[] = [
  { code: 'лимп', label: 'лимп', groupId: 'preflop', sortOrder: 1, isSystem: true },
  { code: 'шир 3б', label: 'шир 3б', groupId: 'preflop', sortOrder: 2, isSystem: true },
  { code: 'фолд на 3б', label: 'фолд на 3б', groupId: 'preflop', sortOrder: 3, isSystem: true },
  { code: '4бет ~0', label: '4бет ~0', groupId: 'preflop', sortOrder: 4, isSystem: true },
  { code: 'лимп-пуш', label: 'лимп-пуш', groupId: 'preflop', sortOrder: 5, isSystem: true },
  { code: 'ОФ после чеков', label: 'ОФ после чеков', groupId: 'postflop', sortOrder: 6, isSystem: true },
  { code: 'чек ТП', label: 'чек ТП', groupId: 'postflop', sortOrder: 7, isSystem: true },
  { code: 'овербет=вэлью', label: 'овербет=вэлью', groupId: 'postflop', sortOrder: 8, isSystem: true },
  { code: 'донк=слабость', label: 'донк=слабость', groupId: 'postflop', sortOrder: 9, isSystem: true },
  { code: 'x/r=натс', label: 'x/r=натс', groupId: 'postflop', sortOrder: 10, isSystem: true },
  { code: 'недоблеф', label: 'недоблеф', groupId: 'bluff_timing', sortOrder: 11, isSystem: true },
  { code: 'переблеф', label: 'переблеф', groupId: 'bluff_timing', sortOrder: 12, isSystem: true },
  { code: 'снэп=воздух', label: 'снэп=воздух', groupId: 'bluff_timing', sortOrder: 13, isSystem: true },
  { code: 'тайминг=вэлью', label: 'тайминг=вэлью', groupId: 'bluff_timing', sortOrder: 14, isSystem: true },
  { code: 'КС 50бб+', label: 'КС 50бб+', groupId: 'stack', sortOrder: 15, isSystem: true },
  { code: 'КС 50бб-', label: 'КС 50бб-', groupId: 'stack', sortOrder: 16, isSystem: true },
];

/** @deprecated используй groupsFromDefs / noteTagsStore — оставлено для тестов seed */
export const QUICK_NOTE_TAG_GROUPS: readonly QuickNoteTagGroup[] =
  groupsFromDefs(NOTE_TAG_SEED);

export function groupsFromDefs(tags: NoteTagDef[]): QuickNoteTagGroup[] {
  const sorted = [...tags].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)
  );
  return NOTE_TAG_GROUP_META.map((meta) => ({
    id: meta.id,
    title: meta.title,
    options: sorted
      .filter((t) => t.groupId === meta.id)
      .map((t) => ({ label: t.label, value: t.code })),
  })).filter((g) => g.options.length > 0);
}

const seedByLower = new Map(
  NOTE_TAG_SEED.map((o) => [o.code.toLowerCase(), o.code] as const)
);

export function listQuickNoteTagOptions(): QuickNoteTagOption[] {
  return NOTE_TAG_SEED.map((t) => ({ label: t.label, value: t.code }));
}

export function normalizeQuickNoteTag(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return seedByLower.get(trimmed.toLowerCase()) ?? null;
}

export function isKnownQuickNoteTag(raw: string): boolean {
  return normalizeQuickNoteTag(raw) !== null;
}
