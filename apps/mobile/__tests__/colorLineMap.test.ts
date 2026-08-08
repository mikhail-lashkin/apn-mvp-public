/**
 * @file: colorLineMap.test.ts
 * @description: Offline ColorSystem rule map (ML-1)
 * @created: 2026-08-08
 */

import { localRuleRecommendation } from '../constants/colorLineMap';

describe('localRuleRecommendation', () => {
  it('maps fish tag to actionable line', () => {
    const rec = localRuleRecommendation('fish', 0);
    expect(rec.source).toBe('rule');
    expect(rec.player_type).toBe('fish');
    expect(rec.caution_flags).toContain('offline');
    expect(rec.recommendation.length).toBeGreaterThan(10);
  });

  it('normalizes legacy nit → tight_reg', () => {
    const rec = localRuleRecommendation('nit', 2);
    expect(rec.player_type).toBe('tight_reg');
  });
});
