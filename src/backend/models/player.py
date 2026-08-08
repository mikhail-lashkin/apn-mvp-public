"""
@file: player.py
@description: ORM модель игрока за столом (Speed Focus UI, TagModal).
@dependencies: sqlalchemy
@created: 2025-03-07
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from src.backend.db.session import Base


class PlayerORM(Base):
    """Игрок за столом: имя, тег, цвет, привязка к столу. Soft delete."""
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    nickname = Column(String(255), nullable=True)
    # SC-6: slug из player_tags (fish, passive_fish, …) или unknown
    player_tag = Column(String(40), nullable=False, server_default="unknown")
    tag_color = Column(String(20), nullable=True)  # hex из справочника
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    is_deleted = Column(Boolean, nullable=False, server_default="false", default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
