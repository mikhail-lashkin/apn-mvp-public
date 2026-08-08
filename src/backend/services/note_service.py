"""
Сервис заметок: CRUD, NoteFilters, ownership + is_deleted, limit cap 100.
Каскад: в get_notes не возвращаем заметки, у которых player is_deleted.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.backend.models.note import NoteORM
from src.backend.models.player import PlayerORM
from src.backend.schemas.note import NoteCreate, NoteUpdate

LIMIT_MAX = 100


@dataclass
class NoteFilters:
    player_id: Optional[int] = None
    table_id: Optional[int] = None
    session_id: Optional[int] = None
    tags: Optional[List[str]] = None
    note_type: Optional[str] = None
    street: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    limit: int = 50
    offset: int = 0

    def clamp_limit(self) -> int:
        return min(max(1, self.limit), LIMIT_MAX)


def create_note(db: Session, note: NoteCreate, user_id: int) -> NoteORM:
    if note.player_id is not None:
        player = (
            db.query(PlayerORM)
            .filter(
                PlayerORM.id == note.player_id,
                PlayerORM.user_id == user_id,
                PlayerORM.is_deleted.is_(False),
            )
            .first()
        )
        if not player:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Игрок не найден или недоступен",
            )

    tags_list = note.tags if note.tags else []
    db_note = NoteORM(
        user_id=user_id,
        text=note.text,
        tags=tags_list,
        player_id=note.player_id,
        table_id=note.table_id,
        session_id=note.session_id,
        note_type=note.note_type.value,
        street=note.street.value if note.street else None,
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


def get_note(db: Session, note_id: int, user_id: int) -> Optional[NoteORM]:
    """Одна заметка по ID. Ownership + не удалённая (только is_deleted is True считаем удалённой; SQLite может давать 0/1)."""
    note = (
        db.query(NoteORM)
        .filter(NoteORM.id == note_id, NoteORM.user_id == user_id)
        .first()
    )
    if not note or note.is_deleted is True:
        return None
    return note


def _base_notes_query(db: Session, user_id: int, f: NoteFilters):
    """Запрос по user_id. Каскад: не показывать заметки удалённого игрока (player.is_deleted)."""
    q = db.query(NoteORM).filter(NoteORM.user_id == user_id)
    # Исключить заметки, привязанные к удалённому игроку (подзапрос — совместимо с SQLite)
    deleted_player_ids = select(PlayerORM.id).where(
        PlayerORM.user_id == user_id,
        PlayerORM.is_deleted == True,
    )
    q = q.filter(
        or_(
            NoteORM.player_id.is_(None),
            ~NoteORM.player_id.in_(deleted_player_ids),
        )
    )
    if f.player_id is not None:
        q = q.filter(NoteORM.player_id == f.player_id)
    if f.table_id is not None:
        q = q.filter(NoteORM.table_id == f.table_id)
    if f.session_id is not None:
        q = q.filter(NoteORM.session_id == f.session_id)
    if f.note_type is not None:
        q = q.filter(NoteORM.note_type == f.note_type)
    if f.street is not None:
        q = q.filter(NoteORM.street == f.street)
    if f.tags:
        for tag in f.tags:
            q = q.filter(NoteORM.tags.contains([tag]))
    if f.date_from is not None:
        q = q.filter(NoteORM.created_at >= f.date_from)
    if f.date_to is not None:
        q = q.filter(NoteORM.created_at <= f.date_to)
    return q


def get_notes(db: Session, user_id: int, f: NoteFilters) -> List[NoteORM]:
    limit = f.clamp_limit()
    return (
        _base_notes_query(db, user_id, f)
        .order_by(NoteORM.created_at.desc())
        .offset(f.offset)
        .limit(limit)
        .all()
    )


def get_note_count(db: Session, user_id: int, f: NoteFilters) -> int:
    """Количество по тем же фильтрам, что и get_notes (для total в ответе)."""
    return _base_notes_query(db, user_id, f).count()


def update_note(db: Session, note_id: int, payload: NoteUpdate, user_id: int) -> NoteORM:
    db_note = get_note(db, note_id, user_id)
    if not db_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заметка не найдена",
        )
    if payload.text is not None:
        db_note.text = payload.text
    if payload.tags is not None:
        db_note.tags = payload.tags
    if payload.player_id is not None:
        db_note.player_id = payload.player_id
    if payload.table_id is not None:
        db_note.table_id = payload.table_id
    if payload.session_id is not None:
        db_note.session_id = payload.session_id
    if payload.note_type is not None:
        db_note.note_type = payload.note_type.value
    if payload.street is not None:
        db_note.street = payload.street.value
    db.commit()
    db.refresh(db_note)
    return db_note


def delete_note(db: Session, note_id: int, user_id: int) -> None:
    """Soft delete: выставить is_deleted=True."""
    db_note = get_note(db, note_id, user_id)
    if not db_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заметка не найдена",
        )
    db_note.is_deleted = True
    db.commit()
