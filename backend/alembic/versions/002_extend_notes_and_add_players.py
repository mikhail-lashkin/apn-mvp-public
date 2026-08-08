"""extend_notes_and_add_players: таблица players, расширение notes

Revision ID: 002_notes_players
Revises: 001_initial
Create Date: 2025-03-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002_notes_players'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Таблица players (до изменений notes, т.к. notes.player_id -> players.id)
    op.create_table(
        'players',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('nickname', sa.String(length=255), nullable=True),
        sa.Column('player_tag', sa.String(length=20), nullable=False, server_default='unknown'),
        sa.Column('tag_color', sa.String(length=20), nullable=True),
        sa.Column('table_id', sa.Integer(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_players_id'), 'players', ['id'], unique=False)

    # 2. Расширение notes: новые колонки
    op.add_column('notes', sa.Column('player_id', sa.Integer(), nullable=True))
    op.add_column('notes', sa.Column('table_id', sa.Integer(), nullable=True))
    op.add_column('notes', sa.Column('session_id', sa.Integer(), nullable=True))
    op.add_column('notes', sa.Column('note_type', sa.String(length=20), nullable=True))
    op.add_column('notes', sa.Column('street', sa.String(length=20), nullable=True))
    op.add_column('notes', sa.Column('is_deleted', sa.Boolean(), nullable=True))

    # Дефолты для существующих строк
    op.execute("UPDATE notes SET note_type = 'general' WHERE note_type IS NULL")
    op.execute("UPDATE notes SET is_deleted = false WHERE is_deleted IS NULL")

    op.alter_column('notes', 'note_type', nullable=False, server_default='general')
    op.alter_column('notes', 'is_deleted', nullable=False, server_default='false')

    # FK для новых колонок
    op.create_foreign_key('fk_notes_player_id', 'notes', 'players', ['player_id'], ['id'])
    op.create_foreign_key('fk_notes_table_id', 'notes', 'tables', ['table_id'], ['id'])
    op.create_foreign_key('fk_notes_session_id', 'notes', 'sessions', ['session_id'], ['id'])

    # Изменение типов: text -> Text, tags -> JSON
    op.alter_column('notes', 'text', existing_type=sa.String(), type_=sa.Text(), existing_nullable=False)
    # PostgreSQL: конвертируем tags из string в JSON (пустой массив для NULL или пустой строки)
    op.execute("""
        ALTER TABLE notes
        ALTER COLUMN tags TYPE jsonb
        USING CASE
            WHEN tags IS NULL OR trim(tags) = '' THEN '[]'::jsonb
            ELSE ('["' || replace(replace(trim(tags), '","', '","'), ',', '","') || '"]')::jsonb
        END
    """)

    # CheckConstraint для note_type и street
    op.create_check_constraint(
        'ck_notes_note_type',
        'notes',
        "note_type IN ('exploit', 'read', 'general', 'timing', 'sizing')"
    )
    op.create_check_constraint(
        'ck_notes_street',
        'notes',
        "street IS NULL OR street IN ('preflop', 'flop', 'turn', 'river')"
    )

    # Составные индексы
    op.create_index('ix_notes_user_player', 'notes', ['user_id', 'player_id'], unique=False)
    op.create_index('ix_notes_user_deleted', 'notes', ['user_id', 'is_deleted'], unique=False)

    # Перевести created_at, updated_at на timezone-aware (PostgreSQL)
    op.alter_column(
        'notes', 'created_at',
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using='created_at AT TIME ZONE \'UTC\''
    )
    op.alter_column(
        'notes', 'updated_at',
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using='updated_at AT TIME ZONE \'UTC\''
    )


def downgrade() -> None:
    op.drop_index('ix_notes_user_deleted', table_name='notes')
    op.drop_index('ix_notes_user_player', table_name='notes')
    op.drop_constraint('ck_notes_street', 'notes', type_='check')
    op.drop_constraint('ck_notes_note_type', 'notes', type_='check')

    op.alter_column('notes', 'created_at', type_=sa.DateTime(), existing_type=sa.DateTime(timezone=True))
    op.alter_column('notes', 'updated_at', type_=sa.DateTime(), existing_type=sa.DateTime(timezone=True))

    op.drop_constraint('fk_notes_session_id', 'notes', type_='foreignkey')
    op.drop_constraint('fk_notes_table_id', 'notes', type_='foreignkey')
    op.drop_constraint('fk_notes_player_id', 'notes', type_='foreignkey')

    op.drop_column('notes', 'is_deleted')
    op.drop_column('notes', 'street')
    op.drop_column('notes', 'note_type')
    op.drop_column('notes', 'session_id')
    op.drop_column('notes', 'table_id')
    op.drop_column('notes', 'player_id')

    op.alter_column('notes', 'text', existing_type=sa.Text(), type_=sa.String(), existing_nullable=False)
    op.alter_column(
        'notes', 'tags',
        existing_type=postgresql.JSONB(),
        type_=sa.String(),
        postgresql_using="COALESCE((SELECT string_agg(x, ',') FROM jsonb_array_elements_text(tags) x), '')"
    )

    op.drop_index(op.f('ix_players_id'), table_name='players')
    op.drop_table('players')
