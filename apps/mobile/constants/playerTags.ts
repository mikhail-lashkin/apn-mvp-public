/**
 * @file: playerTags.ts
 * @description: Seed меток ColorSystem = Colors_to_PlayerTypes (начальный набор app)
 * @created: 2026-07-15
 * @updated: 2026-07-21
 */

export type PlayerTagDef = {
  /** backend id; локальный офлайн — `local_<ts>` */
  id?: number | string;
  code: string;
  label: string;
  color: string;
  sortOrder: number;
  isSystem?: boolean;
};

/** Палитра создания/редактирования — hex из Colors_to_PlayerTypes */
export const PLAYER_TAG_PALETTE = [
  '#A855F7', // VIP / whale
  '#EF4444', // fish
  '#38BDF8', // passive_fish
  '#F97316', // aggro_fish
  '#EC4899', // vip_aggressive
  '#15803D', // tight_reg
  '#22C55E', // standard_reg
  '#3B82F6', // unknown 100bb (UI)
  '#EAB308', // unknown_ss
  '#6B7280', // unknown без стека
] as const;

/**
 * Начальный набор = ColorSystem (Obsidian Colors_to_PlayerTypes).
 * Порядок как в таблице: VIP → любители → регы → short-stack unknown.
 * UNKNOWN без стека / EMPTY — не в seed (состояния стола).
 */
export const PLAYER_TAG_SEED: readonly PlayerTagDef[] = [
  {
    code: 'whale',
    label: '🐋 VIP 60+',
    color: '#A855F7',
    sortOrder: 1,
    isSystem: true,
  },
  {
    code: 'fish',
    label: '🐟 Fish',
    color: '#EF4444',
    sortOrder: 2,
    isSystem: true,
  },
  {
    code: 'passive_fish',
    label: '🫧 Passive fish',
    color: '#38BDF8',
    sortOrder: 3,
    isSystem: true,
  },
  {
    code: 'aggro_fish',
    label: '🐡 Aggro fish',
    color: '#F97316',
    sortOrder: 4,
    isSystem: true,
  },
  {
    code: 'vip_aggressive',
    label: '📱 VIP Aggressive',
    color: '#EC4899',
    sortOrder: 5,
    isSystem: true,
  },
  {
    code: 'tight_reg',
    label: '📒 Tight Reg',
    color: '#15803D',
    sortOrder: 6,
    isSystem: true,
  },
  {
    code: 'standard_reg',
    label: '🃏 Standard Reg',
    color: '#22C55E',
    sortOrder: 7,
    isSystem: true,
  },
  {
    code: 'unknown_ss',
    label: '🟡 Unknown <100bb',
    color: '#EAB308',
    sortOrder: 8,
    isSystem: true,
  },
] as const;

const byCode = new Map(PLAYER_TAG_SEED.map((t) => [t.code, t] as const));

/** Старые seed/enum → актуальный slug (данные могут жить в кэше/API) */
const LEGACY_MAP: Record<string, string> = {
  fish: 'fish',
  passive: 'passive_fish',
  passive_fish: 'passive_fish',
  whale: 'whale',
  vip: 'whale',
  aggro: 'aggro_fish',
  aggro_fish: 'aggro_fish',
  maniac: 'aggro_fish',
  // nit убран из seed → ближайший ColorSystem
  nit: 'tight_reg',
  tag: 'tight_reg',
  tight_reg: 'tight_reg',
  reg: 'standard_reg',
  regular: 'standard_reg',
  standard_reg: 'standard_reg',
  // lag/aggro_reg убраны → не путать с aggro_fish; ближе solid reg
  lag: 'standard_reg',
  aggro_reg: 'standard_reg',
  vip_a: 'vip_aggressive',
  vip_aggressive: 'vip_aggressive',
  unknown_ss: 'unknown_ss',
  overbet: 'fish',
  underdef_bb: 'fish',
  timing: 'standard_reg',
  unknown: 'unknown',
};

/** Цвета для UI-состояний и сиротских кодов (не в seed) */
const EXTRA_COLORS: Record<string, string> = {
  unknown: '#6B7280',
  empty: '#9CA3AF',
  // blue 100bb — временно, если придёт без seed-строки
  unknown_100: '#3B82F6',
};

export function normalizePlayerTagCode(raw: string | null | undefined): string {
  if (!raw || !String(raw).trim()) return 'unknown';
  const key = String(raw).trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (LEGACY_MAP[key]) return LEGACY_MAP[key];
  // seed + custom slug — не схлопываем в fish
  return key;
}

export function getPlayerTagDef(code: string | null | undefined): PlayerTagDef | null {
  const normalized = normalizePlayerTagCode(code);
  if (normalized === 'unknown' || normalized === 'empty') return null;
  return byCode.get(normalized) ?? null;
}

export function getPlayerTagColor(code: string | null | undefined, fallback = '#6B7280'): string {
  const normalized = normalizePlayerTagCode(code);
  const fromSeed = getPlayerTagDef(normalized)?.color;
  if (fromSeed) return fromSeed;
  return EXTRA_COLORS[normalized] ?? fallback;
}

export function listPlayerTagOptions(): { label: string; value: string; color: string }[] {
  return PLAYER_TAG_SEED.map((t) => ({
    label: t.label,
    value: t.code,
    color: t.color,
  }));
}
