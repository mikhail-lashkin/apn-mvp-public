"""note_tags SC-3 seed (быстрые теги заметки)

Revision ID: 004_note_tags
Revises: 003_player_tags
Create Date: 2026-07-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "004_note_tags"
down_revision: Union[str, None] = "003_player_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (code, label, group_id, sort_order) — code = value в note.tags[]
SEED = [
    ("лимп", "лимп", "preflop", 1),
    ("шир 3б", "шир 3б", "preflop", 2),
    ("фолд на 3б", "фолд на 3б", "preflop", 3),
    ("4бет ~0", "4бет ~0", "preflop", 4),
    ("лимп-пуш", "лимп-пуш", "preflop", 5),
    ("ОФ после чеков", "ОФ после чеков", "postflop", 6),
    ("чек ТП", "чек ТП", "postflop", 7),
    ("овербет=вэлью", "овербет=вэлью", "postflop", 8),
    ("донк=слабость", "донк=слабость", "postflop", 9),
    ("x/r=натс", "x/r=натс", "postflop", 10),
    ("недоблеф", "недоблеф", "bluff_timing", 11),
    ("переблеф", "переблеф", "bluff_timing", 12),
    ("снэп=воздух", "снэп=воздух", "bluff_timing", 13),
    ("тайминг=вэлью", "тайминг=вэлью", "bluff_timing", 14),
    ("КС 50бб+", "КС 50бб+", "stack", 15),
    ("КС 50бб-", "КС 50бб-", "stack", 16),
]


def upgrade() -> None:
    op.create_table(
        "note_tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("group_id", sa.String(length=40), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_note_tags_id"), "note_tags", ["id"], unique=False)
    op.create_index(op.f("ix_note_tags_code"), "note_tags", ["code"], unique=True)
    op.create_index(op.f("ix_note_tags_group_id"), "note_tags", ["group_id"], unique=False)

    conn = op.get_bind()
    for code, label, group_id, sort_order in SEED:
        conn.execute(
            sa.text(
                "INSERT INTO note_tags (code, label, group_id, sort_order, is_system) "
                "VALUES (:code, :label, :group_id, :sort_order, true)"
            ),
            {
                "code": code,
                "label": label,
                "group_id": group_id,
                "sort_order": sort_order,
            },
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_note_tags_group_id"), table_name="note_tags")
    op.drop_index(op.f("ix_note_tags_code"), table_name="note_tags")
    op.drop_index(op.f("ix_note_tags_id"), table_name="note_tags")
    op.drop_table("note_tags")
