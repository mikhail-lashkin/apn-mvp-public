"""Initial migration: create all tables

Revision ID: 001_initial
Revises: 
Create Date: 2025-01-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Создание таблицы users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Создание таблицы notes
    op.create_table(
        'notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.String(), nullable=False),
        sa.Column('tags', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notes_id'), 'notes', ['id'], unique=False)

    # Создание таблицы player_profiles
    op.create_table(
        'player_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('style', sa.String(length=100), nullable=True),
        sa.Column('patterns', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('leaks', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('exploits', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('traps', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('regions', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_player_profiles_id'), 'player_profiles', ['id'], unique=False)
    op.create_index(op.f('ix_player_profiles_name'), 'player_profiles', ['name'], unique=False)
    op.create_index(op.f('ix_player_profiles_style'), 'player_profiles', ['style'], unique=False)

    # Создание таблицы templates
    op.create_table(
        'templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=100), nullable=True),
        sa.Column('fields', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('sections', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('template_content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_templates_id'), 'templates', ['id'], unique=False)
    op.create_index(op.f('ix_templates_name'), 'templates', ['name'], unique=False)
    op.create_index(op.f('ix_templates_type'), 'templates', ['type'], unique=False)

    # Создание таблицы board_analyses
    op.create_table(
        'board_analyses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.String(length=50), nullable=True),
        sa.Column('spot', sa.String(length=100), nullable=True),
        sa.Column('board_texture', sa.String(length=100), nullable=True),
        sa.Column('flop', sa.String(length=50), nullable=True),
        sa.Column('gto_baseline', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('simplified_strategy', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('exploit_adaptation', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('live_notes', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_board_analyses_id'), 'board_analyses', ['id'], unique=False)
    op.create_index(op.f('ix_board_analyses_date'), 'board_analyses', ['date'], unique=False)
    op.create_index(op.f('ix_board_analyses_spot'), 'board_analyses', ['spot'], unique=False)
    op.create_index(op.f('ix_board_analyses_board_texture'), 'board_analyses', ['board_texture'], unique=False)

    # Создание таблицы tables
    op.create_table(
        'tables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('hero_position', sa.Integer(), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('limits', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tables_id'), 'tables', ['id'], unique=False)

    # Создание таблицы sessions
    op.create_table(
        'sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('table_id', sa.Integer(), nullable=True),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=True),
        sa.Column('buy_in', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('cash_out', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('profit', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('notes_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sessions_id'), 'sessions', ['id'], unique=False)


def downgrade() -> None:
    # Удаление таблиц в обратном порядке (сначала зависимые)
    op.drop_index(op.f('ix_sessions_id'), table_name='sessions')
    op.drop_table('sessions')
    
    op.drop_index(op.f('ix_tables_id'), table_name='tables')
    op.drop_table('tables')
    
    op.drop_index(op.f('ix_board_analyses_board_texture'), table_name='board_analyses')
    op.drop_index(op.f('ix_board_analyses_spot'), table_name='board_analyses')
    op.drop_index(op.f('ix_board_analyses_date'), table_name='board_analyses')
    op.drop_index(op.f('ix_board_analyses_id'), table_name='board_analyses')
    op.drop_table('board_analyses')
    
    op.drop_index(op.f('ix_templates_type'), table_name='templates')
    op.drop_index(op.f('ix_templates_name'), table_name='templates')
    op.drop_index(op.f('ix_templates_id'), table_name='templates')
    op.drop_table('templates')
    
    op.drop_index(op.f('ix_player_profiles_style'), table_name='player_profiles')
    op.drop_index(op.f('ix_player_profiles_name'), table_name='player_profiles')
    op.drop_index(op.f('ix_player_profiles_id'), table_name='player_profiles')
    op.drop_table('player_profiles')
    
    op.drop_index(op.f('ix_notes_id'), table_name='notes')
    op.drop_table('notes')
    
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
