"""player_tags ColorSystem seed + migrate legacy player_tag

Revision ID: 003_player_tags
Revises: 002_notes_players
Create Date: 2026-07-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "003_player_tags"
down_revision: Union[str, None] = "002_notes_players"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = [
    ("fish", "🐟 Fish", "#22C55E", 1),
    ("passive_fish", "🫧 Passive fish", "#67E8F9", 2),
    ("whale", "🐋 Whale", "#0EA5E9", 3),
    ("aggro_fish", "🐡 Aggro fish", "#F97316", 4),
    ("nit", "♦️ Nit", "#A855F7", 5),
    ("tight_reg", "📒 Tight Reg", "#EAB308", 6),
    ("standard_reg", "🃏 Standard Reg", "#3B82F6", 7),
    ("aggro_reg", "🗡️ Aggro reg", "#EF4444", 8),
]

# lower(old) → new code
LEGACY_MAP_SQL = """
UPDATE players SET player_tag = CASE lower(trim(player_tag))
    WHEN 'fish' THEN 'fish'
    WHEN 'passive' THEN 'passive_fish'
    WHEN 'passive_fish' THEN 'passive_fish'
    WHEN 'whale' THEN 'whale'
    WHEN 'aggro' THEN 'aggro_fish'
    WHEN 'aggro_fish' THEN 'aggro_fish'
    WHEN 'maniac' THEN 'aggro_fish'
    WHEN 'nit' THEN 'nit'
    WHEN 'tag' THEN 'tight_reg'
    WHEN 'tight_reg' THEN 'tight_reg'
    WHEN 'reg' THEN 'standard_reg'
    WHEN 'standard_reg' THEN 'standard_reg'
    WHEN 'lag' THEN 'aggro_reg'
    WHEN 'aggro_reg' THEN 'aggro_reg'
    WHEN 'overbet' THEN 'fish'
    WHEN 'underdef_bb' THEN 'fish'
    WHEN 'timing' THEN 'standard_reg'
    WHEN 'unknown' THEN 'unknown'
    ELSE 'fish'
END
WHERE player_tag IS NOT NULL AND trim(player_tag) <> ''
"""

COLOR_SYNC_SQL = """
UPDATE players p
SET tag_color = t.color
FROM player_tags t
WHERE p.player_tag = t.code
"""


def upgrade() -> None:
    op.create_table(
        "player_tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_player_tags_id"), "player_tags", ["id"], unique=False)
    op.create_index(op.f("ix_player_tags_code"), "player_tags", ["code"], unique=True)

    # slug'и типа passive_fish длиннее старых 20 — расширяем
    op.alter_column(
        "players",
        "player_tag",
        existing_type=sa.String(length=20),
        type_=sa.String(length=40),
        existing_nullable=False,
        existing_server_default="unknown",
    )

    conn = op.get_bind()
    for code, label, color, sort_order in SEED:
        conn.execute(
            sa.text(
                "INSERT INTO player_tags (code, label, color, sort_order, is_system) "
                "VALUES (:code, :label, :color, :sort_order, true)"
            ),
            {"code": code, "label": label, "color": color, "sort_order": sort_order},
        )

    op.execute(LEGACY_MAP_SQL)
    op.execute(COLOR_SYNC_SQL)


def downgrade() -> None:
    # откат данных меток — приблизительный (seed → старые грубые ярлыки)
    op.execute(
        """
        UPDATE players SET player_tag = CASE player_tag
            WHEN 'fish' THEN 'fish'
            WHEN 'passive_fish' THEN 'passive'
            WHEN 'whale' THEN 'fish'
            WHEN 'aggro_fish' THEN 'aggro'
            WHEN 'nit' THEN 'nit'
            WHEN 'tight_reg' THEN 'tag'
            WHEN 'standard_reg' THEN 'reg'
            WHEN 'aggro_reg' THEN 'lag'
            ELSE 'unknown'
        END
        """
    )
    op.alter_column(
        "players",
        "player_tag",
        existing_type=sa.String(length=40),
        type_=sa.String(length=20),
        existing_nullable=False,
        existing_server_default="unknown",
    )
    op.drop_index(op.f("ix_player_tags_code"), table_name="player_tags")
    op.drop_index(op.f("ix_player_tags_id"), table_name="player_tags")
    op.drop_table("player_tags")
