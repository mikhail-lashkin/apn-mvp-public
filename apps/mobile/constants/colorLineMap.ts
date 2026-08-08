/**
 * @file: colorLineMap.ts
 * @description: Client-side ColorSystem → линия (offline cold-start / fallback ML-1)
 * @dependencies: playerTags
 * @created: 2026-08-08
 */

import { normalizePlayerTagCode } from './playerTags';

export type LocalRecommendation = {
  player_type: string;
  confidence: number;
  patterns: string[];
  suggested_tags: string[];
  supporting_notes: string[];
  caution_flags: string[];
  recommendation: string;
  source: 'rule' | 'llm';
  provider: 'opencode_go' | 'deepseek' | 'none';
  prompt_version: string;
  last_updated: string;
};

const LINES: Record<string, { line: string; patterns: string[] }> = {
  whale: {
    line: 'Играй value толстыми руками, не блефуй тонко. Дай им поставить.',
    patterns: ['глубокий стек', 'платит value'],
  },
  fish: {
    line: 'Изолируй, value-бет толще обычного. Избегай тонких блефов.',
    patterns: ['широкий диапазон', 'ошибки постфлоп'],
  },
  passive_fish: {
    line: 'Бет/контбет за value. Не блефуй — они редко фолдят.',
    patterns: ['пассивный колл', 'редко рейзит'],
  },
  aggro_fish: {
    line: 'Трапь крепкие руки, колл-даун шире. Не лайт-3бет без эквити.',
    patterns: ['овербет', 'агрессия без диапазона'],
  },
  vip_aggressive: {
    line: 'Не форсируй блефы. Дожидайся сильных рук и дай им повеситься.',
    patterns: ['мобильный VIP', 'высокий VPIP'],
  },
  tight_reg: {
    line: 'Стил/3бет с позицией. Не пэй-офф лайт против их рейзов.',
    patterns: ['тайтовый диапазон', 'солидный рег'],
  },
  standard_reg: {
    line: 'Стандартные размеры, ищи leaks в их 3бет/C-bet частотах.',
    patterns: ['balanced-ish', 'знакомые линии'],
  },
  unknown_ss: {
    line: 'Осторожно со стеком <100bb: пуш/фолд споты, не раздувай банк вслепую.',
    patterns: ['короткий стек', 'мало данных'],
  },
  unknown: {
    line: 'Собери 1–2 заметки и метку ColorSystem — пока играй стандартно.',
    patterns: [],
  },
};

export function localRuleRecommendation(
  playerTag: string | null | undefined,
  noteCount = 0
): LocalRecommendation {
  const code = normalizePlayerTagCode(playerTag);
  const row = LINES[code] ?? LINES.unknown;
  const flags: string[] = ['offline'];
  if (noteCount <= 0) {
    flags.push('no notes');
    flags.push(code === 'unknown' ? 'cold start' : 'tag only');
  } else if (noteCount < 3) {
    flags.push('low sample size');
  }

  return {
    player_type: code === 'empty' ? 'unknown' : code,
    confidence: code === 'unknown' ? 0.2 : noteCount <= 0 ? 0.35 : 0.45,
    patterns: [...row.patterns],
    suggested_tags: code === 'unknown' || code === 'empty' ? [] : [code],
    supporting_notes: [],
    caution_flags: flags,
    recommendation: row.line,
    source: 'rule',
    provider: 'none',
    prompt_version: 'v1',
    last_updated: new Date().toISOString(),
  };
}
