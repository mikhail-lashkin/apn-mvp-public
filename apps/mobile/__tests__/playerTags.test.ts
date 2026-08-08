/**
 * @file: playerTags.test.ts
 * @description: ColorSystem seed = Colors_to_PlayerTypes
 * @created: 2026-07-15
 * @updated: 2026-07-21
 */

import {
  PLAYER_TAG_SEED,
  normalizePlayerTagCode,
  getPlayerTagColor,
  getPlayerTagDef,
} from '../constants/playerTags';

describe('playerTags ColorSystem', () => {
  it('seed = 8 меток Colors_to_PlayerTypes', () => {
    expect(PLAYER_TAG_SEED).toHaveLength(8);
    expect(PLAYER_TAG_SEED.map((t) => t.code)).toEqual([
      'whale',
      'fish',
      'passive_fish',
      'aggro_fish',
      'vip_aggressive',
      'tight_reg',
      'standard_reg',
      'unknown_ss',
    ]);
  });

  it('hex совпадает с Colors_to_PlayerTypes', () => {
    expect(getPlayerTagColor('whale')).toBe('#A855F7');
    expect(getPlayerTagColor('fish')).toBe('#EF4444');
    expect(getPlayerTagColor('passive_fish')).toBe('#38BDF8');
    expect(getPlayerTagColor('tight_reg')).toBe('#15803D');
    expect(getPlayerTagColor('standard_reg')).toBe('#22C55E');
    expect(getPlayerTagColor('unknown')).toBe('#6B7280');
  });

  it('мапит legacy enum на ColorSystem', () => {
    expect(normalizePlayerTagCode('FISH')).toBe('fish');
    expect(normalizePlayerTagCode('LAG')).toBe('standard_reg');
    expect(normalizePlayerTagCode('NIT')).toBe('tight_reg');
    expect(normalizePlayerTagCode('TAG')).toBe('tight_reg');
    expect(normalizePlayerTagCode('PASSIVE')).toBe('passive_fish');
    expect(normalizePlayerTagCode('MANIAC')).toBe('aggro_fish');
    expect(normalizePlayerTagCode('VIP')).toBe('whale');
    expect(normalizePlayerTagCode('OVERBET')).toBe('fish');
    expect(normalizePlayerTagCode('unknown')).toBe('unknown');
  });

  it('отдаёт label VIP', () => {
    expect(getPlayerTagDef('whale')?.label).toContain('VIP');
    expect(getPlayerTagDef('vip_aggressive')?.color).toBe('#EC4899');
  });
});
