"""
@file: note.py
@description: ORM модель заметки. Pydantic-схемы вынесены в src.backend.schemas.note.
@dependencies: sqlalchemy
@created: 2024-07-09
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Index, CheckConstraint
from sqlalchemy.sql import func
from src.backend.db.session import Base
from src.backend.models.enums import NOTE_TYPE_VALUES, STREET_VALUES


class NoteORM(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    text = Column(Text, nullable=False)
    tags = Column(JSON, nullable=True)  # список строк
    note_type = Column(String(20), nullable=False, server_default="general")
    street = Column(String(20), nullable=True)
    is_deleted = Column(Boolean, nullable=False, server_default="false", default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            f"note_type IN ({', '.join(repr(v) for v in NOTE_TYPE_VALUES)})",
            name="ck_notes_note_type",
        ),
        CheckConstraint(
            f"street IS NULL OR street IN ({', '.join(repr(v) for v in STREET_VALUES)})",
            name="ck_notes_street",
        ),
        Index("ix_notes_user_player", "user_id", "player_id"),
        Index("ix_notes_user_deleted", "user_id", "is_deleted"),
    )
