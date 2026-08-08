/**
 * @file: recommendationApi.ts
 * @description: ML-1 POST /players/{id}/recommendation
 * @dependencies: apiClient
 * @created: 2026-08-08
 */

import { apiClient } from './client';

export type RecommendationResponse = {
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

export type RecommendationRequestBody = {
  force_refresh?: boolean;
  provider?: 'opencode_go' | 'deepseek' | 'off' | null;
};

export const recommendationApi = {
  async getForPlayer(
    playerBackendId: number,
    body: RecommendationRequestBody = {}
  ): Promise<RecommendationResponse> {
    return apiClient.post<RecommendationResponse>(
      `/players/${playerBackendId}/recommendation`,
      body
    );
  },
};
