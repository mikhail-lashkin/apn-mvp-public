"""
@file: settings.py
@description: Env-конфиг ML LLM провайдеров (Opencode Go / DeepSeek)
@created: 2026-08-08
"""

import os
from dataclasses import dataclass
from typing import Literal, Optional

ProviderId = Literal["opencode_go", "deepseek", "off"]

DEFAULT_OPENCODE_BASE = "https://opencode.ai/zen/go/v1"
DEFAULT_DEEPSEEK_BASE = "https://api.deepseek.com/v1"
# На /zen/go/v1/models id без префикса opencode-go/ (иначе 401 ModelError)
DEFAULT_OPENCODE_MODEL = "deepseek-v4-pro"
DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro"


@dataclass(frozen=True)
class LlmProviderConfig:
    provider: ProviderId
    base_url: str
    model: str
    api_key: str


def _normalize_provider(raw: Optional[str]) -> ProviderId:
    key = (raw or "off").strip().lower().replace("-", "_")
    if key in ("opencode_go", "opencode", "zen_go", "go"):
        return "opencode_go"
    if key in ("deepseek", "ds"):
        return "deepseek"
    return "off"


def resolve_provider(override: Optional[str] = None) -> ProviderId:
    if override is not None:
        return _normalize_provider(override)
    return _normalize_provider(os.getenv("ML_LLM_PROVIDER", "off"))


def get_provider_config(provider: Optional[str] = None) -> Optional[LlmProviderConfig]:
    """None если provider=off или нет ключа."""
    pid = resolve_provider(provider)
    if pid == "off":
        return None

    if pid == "opencode_go":
        key = (os.getenv("OPENCODE_API_KEY") or "").strip()
        if not key:
            return None
        base = (os.getenv("OPENCODE_BASE_URL") or DEFAULT_OPENCODE_BASE).rstrip("/")
        model = os.getenv("OPENCODE_MODEL") or DEFAULT_OPENCODE_MODEL
        return LlmProviderConfig(pid, base, model, key)

    key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
    if not key:
        return None
    base = (os.getenv("DEEPSEEK_BASE_URL") or DEFAULT_DEEPSEEK_BASE).rstrip("/")
    model = os.getenv("DEEPSEEK_MODEL") or DEFAULT_DEEPSEEK_MODEL
    return LlmProviderConfig("deepseek", base, model, key)
