"""
@file: test_player_tags.py
@description: ColorSystem normalize + seed Colors_to_PlayerTypes
@created: 2026-07-15
@updated: 2026-07-21
"""

import src.backend.models.player_tag  # noqa: F401 — регистрирует таблицу в Base
from src.backend.constants.color_system import (
    COLOR_SYSTEM_SEED,
    normalize_player_tag_code,
)
from src.backend.models.player import PlayerORM
from src.backend.services import player_tag_service as pts


def test_color_system_seed_colors_to_player_types():
    assert len(COLOR_SYSTEM_SEED) == 8
    codes = [row[0] for row in COLOR_SYSTEM_SEED]
    assert codes == [
        "whale",
        "fish",
        "passive_fish",
        "aggro_fish",
        "vip_aggressive",
        "tight_reg",
        "standard_reg",
        "unknown_ss",
    ]
    by_code = {row[0]: row for row in COLOR_SYSTEM_SEED}
    assert by_code["whale"][2] == "#A855F7"
    assert by_code["fish"][2] == "#EF4444"
    assert by_code["passive_fish"][2] == "#38BDF8"


def test_legacy_map():
    assert normalize_player_tag_code("FISH") == "fish"
    assert normalize_player_tag_code("lag") == "standard_reg"
    assert normalize_player_tag_code("TAG") == "tight_reg"
    assert normalize_player_tag_code("nit") == "tight_reg"
    assert normalize_player_tag_code("maniac") == "aggro_fish"
    assert normalize_player_tag_code("vip") == "whale"
    assert normalize_player_tag_code("unknown") == "unknown"
    assert normalize_player_tag_code("") == "unknown"
    assert normalize_player_tag_code(None) == "unknown"


def test_slugify_code():
    assert pts._slugify_code("My Tag") == "my_tag"
    assert pts._slugify_code("🐟 Fish Extra") == "fish_extra"
    assert pts._slugify_code("🐟") == "custom"
    assert pts._slugify_code("Привет") == "custom"


def test_create_and_delete_remaps_players(db):
    from src.backend.models.user import UserORM

    user = UserORM(email="tags@test.local", hashed_password="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    row = pts.create_player_tag(db, label="Bluffer", color="#EC4899")
    assert row.code == "bluffer"
    assert row.is_system is False

    player = PlayerORM(
        user_id=user.id,
        name="P1",
        player_tag=row.code,
        tag_color=row.color,
    )
    db.add(player)
    db.commit()

    pts.delete_player_tag(db, row.id)
    db.refresh(player)
    assert player.player_tag == "unknown"
    assert pts.get_by_code(db, "bluffer") is None
