/**
 * @file: quickNoteTags.test.ts
 * @description: Нормализация и seed SC-3 quick-tags
 * @created: 2026-07-15
 */

import {
  QUICK_NOTE_TAG_GROUPS,
  listQuickNoteTagOptions,
  normalizeQuickNoteTag,
} from '../constants/quickNoteTags';

describe('quickNoteTags', () => {
  it('имеет 4 группы цепочки', () => {
    expect(QUICK_NOTE_TAG_GROUPS.map((g) => g.id)).toEqual([
      'preflop',
      'postflop',
      'bluff_timing',
      'stack',
    ]);
  });

  it('seed ~16 тегов', () => {
    expect(listQuickNoteTagOptions().length).toBeGreaterThanOrEqual(15);
    expect(listQuickNoteTagOptions().length).toBeLessThanOrEqual(20);
  });

  it('нормализует кириллицу без изменения канона', () => {
    expect(normalizeQuickNoteTag('лимп')).toBe('лимп');
    expect(normalizeQuickNoteTag('ЛИМП')).toBe('лимп');
    expect(normalizeQuickNoteTag('ОФ после чеков')).toBe('ОФ после чеков');
  });

  it('unknown → null', () => {
    expect(normalizeQuickNoteTag('Fish')).toBeNull();
    expect(normalizeQuickNoteTag('')).toBeNull();
  });
});
