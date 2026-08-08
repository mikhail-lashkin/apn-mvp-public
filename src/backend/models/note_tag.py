"""
@file: note_tag.py
@description: ORM справочника быстрых тегов заметки (SC-7)
@dependencies: sqlalchemy
@created: 2026-07-18
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from src.backend.db.session import Base


class NoteTagORM(Base):
    """Редактируемый справочник тегов заметки. Глобальный seed SC-3."""

    __tablename__ = "note_tags"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(80), nullable=False, unique=True, index=True)
    label = Column(String(80), nullable=False)
    group_id = Column(String(40), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, server_default="0")
    is_system = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
