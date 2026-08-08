"""ColorSystem seed → Colors_to_PlayerTypes (upsert + legacy remap)

Revision ID: 005_colors_player_types
Revises: 004_note_tags
Create Date: 2026-07-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_colors_player_types"
down_revision: Union[str, None] = "004_note_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# sync с src/backend/constants/color_system.py
SEED = [
    ("whale", "🐋 VIP 60+", "#A855F7", 1),
    ("fish", "🐟 Fish", "#EF4444", 2),
    ("passive_fish", "🫧 Passive fish", "#38BDF8", 3),
    ("aggro_fish", "🐡 Aggro fish", "#F97316", 4),
    ("vip_aggressive", "📱 VIP Aggressive", "#EC4899", 5),
    ("tight_reg", "📒 Tight Reg", "#15803D", 6),
    ("standard_reg", "🃏 Standard Reg", "#22C55E", 7),
    ("unknown_ss", "🟡 Unknown <100bb", "#EAB308", 8),
]

OLD_SYSTEM = ("nit", "aggro_reg")


def upgrade() -> None:
    conn = op.get_bind()

    # игроки со старыми system-кодами → ближайший ColorSystem
    conn.execute(
        sa.text(
            """
            UPDATE players SET player_tag = CASE lower(trim(player_tag))
                WHEN 'nit' THEN 'tight_reg'
                WHEN 'aggro_reg' THEN 'standard_reg'
                WHEN 'lag' THEN 'standard_reg'
                WHEN 'vip' THEN 'whale'
                ELSE player_tag
            END
            WHERE player_tag IS NOT NULL
            """
        )
    )

    for code, label, color, sort_order in SEED:
        conn.execute(
            sa.text(
                """
                INSERT INTO player_tags (code, label, color, sort_order, is_system)
                VALUES (:code, :label, :color, :sort_order, true)
                ON CONFLICT (code) DO UPDATE SET
                    label = EXCLUDED.label,
                    color = EXCLUDED.color,
                    sort_order = EXCLUDED.sort_order,
                    is_system = true
                """
            ),
            {
                "code": code,
                "label": label,
                "color": color,
                "sort_order": sort_order,
            },
        )

    for code in OLD_SYSTEM:
        conn.execute(
            sa.text("DELETE FROM player_tags WHERE code = :code AND is_system = true"),
            {"code": code},
        )

    # подтянуть цвета на игроках по актуальному справочнику
    conn.execute(
        sa.text(
            """
            UPDATE players p
            SET tag_color = t.color
            FROM player_tags t
            WHERE p.player_tag = t.code
            """
        )
    )


def downgrade() -> None:
    # частичный откат к SC-6 Tailwind seed — только для dev
    conn = op.get_bind()
    old_seed = [
        ("fish", "🐟 Fish", "#22C55E", 1),
        ("passive_fish", "🫧 Passive fish", "#67E8F9", 2),
        ("whale", "🐋 Whale", "#0EA5E9", 3),
        ("aggro_fish", "🐡 Aggro fish", "#F97316", 4),
        ("nit", "♦️ Nit", "#A855F7", 5),
        ("tight_reg", "📒 Tight Reg", "#EAB308", 6),
        ("standard_reg", "🃏 Standard Reg", "#3B82F6", 7),
        ("aggro_reg", "🗡️ Aggro reg", "#EF4444", 8),
    ]
    conn.execute(sa.text("DELETE FROM player_tags WHERE code = 'vip_aggressive'"))
    conn.execute(sa.text("DELETE FROM player_tags WHERE code = 'unknown_ss'"))
    for code, label, color, sort_order in old_seed:
        conn.execute(
            sa.text(
                """
                INSERT INTO player_tags (code, label, color, sort_order, is_system)
                VALUES (:code, :label, :color, :sort_order, true)
                ON CONFLICT (code) DO UPDATE SET
                    label = EXCLUDED.label,
                    color = EXCLUDED.color,
                    sort_order = EXCLUDED.sort_order,
                    is_system = true
                """
            ),
            {
                "code": code,
                "label": label,
                "color": color,
                "sort_order": sort_order,
            },
        )
