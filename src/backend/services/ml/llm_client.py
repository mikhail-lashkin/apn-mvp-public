"""
@file: llm_client.py
@description: OpenAI-compatible chat/completions для Opencode Go и DeepSeek
@dependencies: httpx, prompts, settings, player_profile_ml
@created: 2026-08-08
"""

import json
import logging
import re
from typing import Optional, Sequence

import httpx

from src.backend.schemas.player_profile_ml import LlmExtractionDraft
from src.backend.services.ml.prompts import SYSTEM_PROMPT_V1, build_user_prompt
from src.backend.services.ml.settings import LlmProviderConfig

logger = logging.getLogger(__name__)

# старый вариант через requests — убрали, httpx async-friendly
# import requests


def _extract_json_blob(raw: str) -> str:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start : end + 1]
    return text


def parse_llm_json(content: str) -> LlmExtractionDraft:
    blob = _extract_json_blob(content)
    data = json.loads(blob)
    return LlmExtractionDraft.model_validate(data)


class LlmClient:
    def __init__(self, timeout: float = 45.0):
        self.timeout = timeout

    def complete_profile(
        self,
        cfg: LlmProviderConfig,
        tag_code: str,
        notes: Sequence[dict],
    ) -> LlmExtractionDraft:
        user_prompt = build_user_prompt(tag_code, notes)
        payload = {
            "model": cfg.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT_V1},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            # просим JSON; часть провайдеров игнорит — парсим вручную
            "response_format": {"type": "json_object"},
        }
        url = f"{cfg.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {cfg.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            logger.warning("LLM HTTP error (%s): %s", cfg.provider, exc)
            raise

        if resp.status_code >= 400:
            logger.warning(
                "LLM %s status=%s body=%s",
                cfg.provider,
                resp.status_code,
                resp.text[:400],
            )
            resp.raise_for_status()

        body = resp.json()
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ValueError(f"unexpected LLM response shape: {exc}") from exc

        # print(f"Debug LLM raw: {content[:200]}")  # TODO: убрать перед релизом
        try:
            return parse_llm_json(content)
        except Exception:
            # retry: иногда модель клеит prose — ещё одна попытка «починки» не делаем,
            # отдаём наверх → rule fallback
            logger.warning("LLM JSON parse failed provider=%s", cfg.provider)
            raise


_default_client: Optional[LlmClient] = None


def get_llm_client() -> LlmClient:
    global _default_client
    if _default_client is None:
        _default_client = LlmClient()
    return _default_client
