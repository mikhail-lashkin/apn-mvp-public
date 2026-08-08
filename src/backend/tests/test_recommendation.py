"""
@file: test_recommendation.py
@description: ML-1 rule baseline, provider config, API cold-start / LLM fallback
@created: 2026-08-08
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from src.backend.models.note import NoteORM
from src.backend.models.player import PlayerORM
from src.backend.models.user import UserORM
from src.backend.schemas.player_profile_ml import LlmExtractionDraft, PlayerProfileMl
from src.backend.services.ml.color_line_map import rule_based_profile
from src.backend.services.ml.llm_client import parse_llm_json
from src.backend.services.ml.recommendation_service import (
    clear_recommendation_cache,
    get_player_recommendation,
)
from src.backend.services.ml.settings import (
    DEFAULT_DEEPSEEK_BASE,
    DEFAULT_DEEPSEEK_MODEL,
    DEFAULT_OPENCODE_BASE,
    DEFAULT_OPENCODE_MODEL,
    get_provider_config,
    resolve_provider,
)
from src.backend.services.security import create_access_token, get_password_hash


@pytest.fixture
def test_user(db: Session):
    user = UserORM(
        email="ml1@test.local",
        hashed_password=get_password_hash("password123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user):
    return create_access_token(data={"sub": test_user.email})


@pytest.fixture(autouse=True)
def _clear_ml_cache():
    clear_recommendation_cache()
    yield
    clear_recommendation_cache()


def test_rule_map_cold_start_fish():
    profile = rule_based_profile("fish", note_ids=[], note_count=0)
    assert profile.source == "rule"
    assert profile.player_type == "fish"
    assert profile.provider == "none"
    assert "no notes" in profile.caution_flags
    assert "value" in profile.recommendation.lower() or "Изолируй" in profile.recommendation


def test_rule_map_unknown():
    profile = rule_based_profile("unknown", note_count=0)
    assert profile.confidence <= 0.25
    assert "cold start" in profile.caution_flags


def test_parse_llm_json_fenced():
    raw = '```json\n{"player_type":"tight_reg","confidence":0.7,"patterns":["тайт"],"suggested_tags":["tight_reg"],"caution_flags":[],"recommendation":"Стил с BTN."}\n```'
    draft = parse_llm_json(raw)
    assert draft.player_type == "tight_reg"
    assert draft.confidence == 0.7


def test_resolve_provider_aliases(monkeypatch):
    monkeypatch.delenv("ML_LLM_PROVIDER", raising=False)
    assert resolve_provider(None) == "off"
    assert resolve_provider("opencode_go") == "opencode_go"
    assert resolve_provider("deepseek") == "deepseek"
    assert resolve_provider("off") == "off"


def test_provider_config_urls(monkeypatch):
    monkeypatch.setenv("OPENCODE_API_KEY", "oc-test-key")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "ds-test-key")
    oc = get_provider_config("opencode_go")
    assert oc is not None
    assert oc.base_url == DEFAULT_OPENCODE_BASE
    assert oc.model == DEFAULT_OPENCODE_MODEL
    ds = get_provider_config("deepseek")
    assert ds is not None
    assert ds.base_url == DEFAULT_DEEPSEEK_BASE
    assert ds.model == DEFAULT_DEEPSEEK_MODEL


def test_provider_missing_key(monkeypatch):
    monkeypatch.delenv("OPENCODE_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    assert get_provider_config("opencode_go") is None
    assert get_provider_config("deepseek") is None


def test_service_cold_start_no_notes(db, test_user, monkeypatch):
    monkeypatch.setenv("ML_LLM_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "fake")
    player = PlayerORM(
        user_id=test_user.id,
        name="Anon",
        player_tag="passive_fish",
    )
    db.add(player)
    db.commit()
    db.refresh(player)

    profile = get_player_recommendation(db, player.id, test_user.id)
    assert profile.source == "rule"
    assert profile.player_type == "passive_fish"
    assert "no notes" in profile.caution_flags


def test_service_llm_success(db, test_user, monkeypatch):
    monkeypatch.setenv("ML_LLM_PROVIDER", "opencode_go")
    monkeypatch.setenv("OPENCODE_API_KEY", "fake-oc")
    player = PlayerORM(user_id=test_user.id, name="Reggie", player_tag="standard_reg")
    db.add(player)
    db.commit()
    db.refresh(player)
    note = NoteORM(
        user_id=test_user.id,
        player_id=player.id,
        text="3бет IP часто, C-bet flop 70%",
        tags=["3bet"],
    )
    db.add(note)
    db.commit()

    draft = LlmExtractionDraft(
        player_type="standard_reg",
        confidence=0.81,
        patterns=["высокий 3бет"],
        suggested_tags=["standard_reg"],
        caution_flags=[],
        recommendation="Не лайт-колл 3беты без позиции.",
    )

    with patch(
        "src.backend.services.ml.recommendation_service.get_llm_client"
    ) as mock_get:
        client = MagicMock()
        client.complete_profile.return_value = draft
        mock_get.return_value = client
        profile = get_player_recommendation(db, player.id, test_user.id)

    assert profile.source == "llm"
    assert profile.provider == "opencode_go"
    assert profile.confidence == 0.81
    assert str(note.id) in profile.supporting_notes
    client.complete_profile.assert_called_once()


def test_service_llm_fallback_on_error(db, test_user, monkeypatch):
    monkeypatch.setenv("ML_LLM_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "fake-ds")
    player = PlayerORM(user_id=test_user.id, name="Fishy", player_tag="fish")
    db.add(player)
    db.commit()
    db.refresh(player)
    db.add(
        NoteORM(
            user_id=test_user.id,
            player_id=player.id,
            text="коллит ривер лайт",
            tags=[],
        )
    )
    db.commit()

    with patch(
        "src.backend.services.ml.recommendation_service.get_llm_client"
    ) as mock_get:
        client = MagicMock()
        client.complete_profile.side_effect = RuntimeError("boom 500")
        mock_get.return_value = client
        profile = get_player_recommendation(db, player.id, test_user.id)

    assert profile.source == "rule"
    assert "llm fallback" in profile.caution_flags


def test_api_recommendation_cold_start(client, db, test_user, auth_token, monkeypatch):
    monkeypatch.setenv("ML_LLM_PROVIDER", "off")
    player = PlayerORM(user_id=test_user.id, name="Whale1", player_tag="whale")
    db.add(player)
    db.commit()
    db.refresh(player)

    resp = client.post(
        f"/players/{player.id}/recommendation",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "rule"
    assert data["player_type"] == "whale"
    assert data["prompt_version"] == "v1"


def test_api_recommendation_404(client, auth_token):
    resp = client.post(
        "/players/999999/recommendation",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"force_refresh": True},
    )
    assert resp.status_code == 404


def test_player_profile_schema_normalizes_legacy():
    p = PlayerProfileMl(
        player_type="NIT",
        confidence=1.5,  # clamp
        patterns=["a", ""],
        suggested_tags=["TAG", "nit"],
        supporting_notes=["1"],
        caution_flags=["low sample size"],
        recommendation="  Блефуй чаще.  ",
        source="rule",
        provider="none",
    )
    assert p.player_type == "tight_reg"
    assert p.confidence == 1.0
    assert p.suggested_tags == ["tight_reg"]
    assert p.recommendation == "Блефуй чаще."


# маленькая eval-фикстура для README / будущего scoring
EVAL_FIXTURES = [
    {
        "tag": "fish",
        "notes": ["коллит даунбеты, редко фолдит"],
        "expect_type": "fish",
    },
    {
        "tag": "tight_reg",
        "notes": ["открывается 15% UTG, 3бет value"],
        "expect_type": "tight_reg",
    },
    {
        "tag": "aggro_fish",
        "notes": ["овербет тёрн почти всегда"],
        "expect_type": "aggro_fish",
    },
]


def test_eval_fixtures_rule_cover():
    for row in EVAL_FIXTURES:
        profile = rule_based_profile(row["tag"], note_count=1, note_ids=["1"])
        assert profile.player_type == row["expect_type"]
        assert len(profile.recommendation) > 10
