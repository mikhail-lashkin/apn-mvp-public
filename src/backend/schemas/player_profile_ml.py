"""
@file: player_profile_ml.py
@description: Pydantic-схемы ML-рекомендации (PlayerProfile JSON, ML-1)
@dependencies: pydantic, color_system
@created: 2026-08-08
"""

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from src.backend.constants.color_system import normalize_player_tag_code

PROMPT_VERSION = "v1"

MlSource = Literal["rule", "llm"]
MlProviderName = Literal["opencode_go", "deepseek", "none"]


class RecommendationRequest(BaseModel):
    force_refresh: bool = False
    # override env default — удобно для demo/Swagger
    provider: Optional[Literal["opencode_go", "deepseek", "off"]] = None


class PlayerProfileMl(BaseModel):
    player_type: str = Field(..., description="ColorSystem slug")
    confidence: float = Field(..., description="0..1")
    patterns: List[str] = Field(default_factory=list)
    suggested_tags: List[str] = Field(default_factory=list)
    supporting_notes: List[str] = Field(default_factory=list)
    caution_flags: List[str] = Field(default_factory=list)
    recommendation: str = Field(..., min_length=1, max_length=800)
    source: MlSource = "rule"
    provider: MlProviderName = "none"
    prompt_version: str = PROMPT_VERSION
    last_updated: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @field_validator("player_type")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        return normalize_player_tag_code(v)

    @field_validator("suggested_tags")
    @classmethod
    def normalize_tags(cls, v: List[str]) -> List[str]:
        out = []
        for raw in v or []:
            code = normalize_player_tag_code(raw)
            if code and code not in ("empty",) and code not in out:
                out.append(code)
        return out[:8]

    @field_validator("patterns", "caution_flags", "supporting_notes")
    @classmethod
    def trim_lists(cls, v: List[str]) -> List[str]:
        cleaned = [str(x).strip() for x in (v or []) if str(x).strip()]
        return cleaned[:12]

    @field_validator("recommendation")
    @classmethod
    def strip_rec(cls, v: str) -> str:
        text = (v or "").strip()
        if not text:
            raise ValueError("recommendation пустая")
        return text[:800]

    @field_validator("confidence")
    @classmethod
    def clamp_conf(cls, v: float) -> float:
        return max(0.0, min(1.0, float(v)))


class LlmExtractionDraft(BaseModel):
    """Сырой JSON от модели до обогащения meta-полями."""

    player_type: str
    confidence: float = 0.5
    patterns: List[str] = Field(default_factory=list)
    suggested_tags: List[str] = Field(default_factory=list)
    caution_flags: List[str] = Field(default_factory=list)
    recommendation: str
