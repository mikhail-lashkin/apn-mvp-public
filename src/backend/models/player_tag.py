"""
@file: player_tag.py
@description: ORM справочника меток игрока (ColorSystem seed). SC-6.
@dependencies: sqlalchemy
@created: 2026-07-15
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from src.backend.db.session import Base


class PlayerTagORM(Base):
    """Редактируемый справочник меток. Сейчас один глобальный набор (seed)."""

    __tablename__ = "player_tags"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(40), nullable=False, unique=True, index=True)
    label = Column(String(80), nullable=False)
    color = Column(String(20), nullable=False)  # hex
    sort_order = Column(Integer, nullable=False, server_default="0")
    is_system = Column(Boolean, nullable=False, server_default="true")
    # TODO: owner_user_id — кастомизация на пользователя (post slice)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
