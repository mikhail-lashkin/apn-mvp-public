"""
@file: recommendation_service.py
@description: Hybrid recommendation: ColorSystem rule + LLM (ML-1)
@dependencies: player_service, NoteORM, llm_client, color_line_map
@created: 2026-08-08
"""

import hashlib
import logging
import time
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from src.backend.constants.color_system import normalize_player_tag_code
from src.backend.models.note import NoteORM
from src.backend.schemas.player_profile_ml import PROMPT_VERSION, PlayerProfileMl
from src.backend.services.ml.color_line_map import rule_based_profile
from src.backend.services.ml.llm_client import get_llm_client
from src.backend.services.ml.settings import get_provider_config, resolve_provider
from src.backend.services.player_service import get_player_profile

logger = logging.getLogger(__name__)

MAX_NOTES = 8
CACHE_TTL_SEC = 15 * 60

# in-memory: key -> (expires_at, profile dict)
_cache: Dict[str, Tuple[float, dict]] = {}


def _cache_get(key: str) -> Optional[PlayerProfileMl]:
    row = _cache.get(key)
    if not row:
        return None
    exp, payload = row
    if time.time() > exp:
        _cache.pop(key, None)
        return None
    return PlayerProfileMl.model_validate(payload)


def _cache_set(key: str, profile: PlayerProfileMl) -> None:
    _cache[key] = (time.time() + CACHE_TTL_SEC, profile.model_dump())


def clear_recommendation_cache() -> None:
    _cache.clear()


def _load_notes(db: Session, player_id: int, user_id: int) -> List[dict]:
    rows = (
        db.query(NoteORM)
        .filter(
            NoteORM.player_id == player_id,
            NoteORM.user_id == user_id,
            NoteORM.is_deleted.is_(False),
        )
        .order_by(NoteORM.created_at.desc())
        .limit(MAX_NOTES)
        .all()
    )
    out = []
    for n in rows:
        out.append(
            {
                "id": str(n.id),
                "text": n.text or "",
                "tags": list(n.tags or []),
            }
        )
    return out


def _cache_key(player_id: int, tag: str, notes: List[dict], provider: str) -> str:
    blob = "|".join(
        f"{n['id']}:{(n.get('text') or '')[:40]}:{','.join(n.get('tags') or [])}"
        for n in notes
    )
    digest = hashlib.sha256(f"{player_id}|{tag}|{provider}|{blob}".encode()).hexdigest()[:24]
    return f"rec:{digest}"


def get_player_recommendation(
    db: Session,
    player_id: int,
    user_id: int,
    *,
    force_refresh: bool = False,
    provider_override: Optional[str] = None,
) -> PlayerProfileMl:
    player = get_player_profile(db, player_id, user_id=user_id)
    if not player:
        raise LookupError("player not found")

    tag = normalize_player_tag_code(player.player_tag)
    notes = _load_notes(db, player_id, user_id)
    note_ids = [n["id"] for n in notes]
    provider_id = resolve_provider(provider_override)

    # cold-start без нотсов — сразу rule (не жжём токены)
    if not notes:
        return rule_based_profile(tag, note_ids=[], note_count=0)

    cfg = get_provider_config(provider_override)
    if cfg is None:
        flags = ["llm unavailable"] if provider_id != "off" else None
        return rule_based_profile(
            tag,
            note_ids=note_ids,
            note_count=len(notes),
            extra_flags=flags,
        )

    key = _cache_key(player_id, tag, notes, cfg.provider)
    if not force_refresh:
        cached = _cache_get(key)
        if cached:
            return cached

    try:
        draft = get_llm_client().complete_profile(cfg, tag, notes)
        profile = PlayerProfileMl(
            player_type=draft.player_type,
            confidence=draft.confidence,
            patterns=draft.patterns,
            suggested_tags=draft.suggested_tags or [tag],
            supporting_notes=note_ids,
            caution_flags=draft.caution_flags,
            recommendation=draft.recommendation,
            source="llm",
            provider=cfg.provider,  # type: ignore[arg-type]
            prompt_version=PROMPT_VERSION,
        )
        _cache_set(key, profile)
        return profile
    except Exception as exc:
        logger.warning("LLM failed, rule fallback: %s", exc)
        return rule_based_profile(
            tag,
            note_ids=note_ids,
            note_count=len(notes),
            extra_flags=["llm fallback"],
        )
