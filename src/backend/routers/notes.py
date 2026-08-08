"""
Роутер Notes API: 5 эндпоинтов, фильтрация, пагинация, DELETE → 200 {"ok": true}.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.backend.db.session import get_db
from src.backend.models.user import UserORM
from src.backend.schemas.note import NoteCreate, NoteRead, NoteUpdate
from src.backend.services.note_service import (
    NoteFilters,
    create_note,
    delete_note,
    get_note,
    get_notes,
    get_note_count,
    update_note,
)
from src.backend.services.user_service import get_current_user

router = APIRouter(prefix="/notes", tags=["notes"])


class NoteListResponse(BaseModel):
    items: List[NoteRead]
    total: int
    limit: int
    offset: int


def note_orm_to_read(note_orm) -> NoteRead:
    tags_list = list(note_orm.tags) if note_orm.tags else []
    return NoteRead(
        id=note_orm.id,
        user_id=note_orm.user_id,
        text=note_orm.text,
        tags=tags_list,
        player_id=note_orm.player_id,
        table_id=note_orm.table_id,
        session_id=note_orm.session_id,
        note_type=note_orm.note_type or "general",
        street=note_orm.street,
        created_at=note_orm.created_at or datetime.utcnow(),
        updated_at=note_orm.updated_at,
    )


@router.get("/", response_model=NoteListResponse)
def get_notes_list(
    player_id: Optional[int] = Query(None, description="Фильтр по ID игрока"),
    table_id: Optional[int] = Query(None, description="Фильтр по ID стола"),
    session_id: Optional[int] = Query(None, description="Фильтр по ID сессии"),
    tags: Optional[str] = Query(None, description="Теги через запятую"),
    note_type: Optional[str] = Query(None, description="Тип заметки"),
    street: Optional[str] = Query(None, description="Улица"),
    date_from: Optional[datetime] = Query(None, description="Начальная дата"),
    date_to: Optional[datetime] = Query(None, description="Конечная дата"),
    limit: int = Query(50, ge=1, le=100, description="Количество записей"),
    offset: int = Query(0, ge=0, description="Смещение"),
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tags_list = [t.strip() for t in tags.split(",")] if tags else None
    f = NoteFilters(
        player_id=player_id,
        table_id=table_id,
        session_id=session_id,
        tags=tags_list,
        note_type=note_type,
        street=street,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    notes = get_notes(db, current_user.id, f)
    total = get_note_count(db, current_user.id, f)
    return NoteListResponse(
        items=[note_orm_to_read(n) for n in notes],
        total=total,
        limit=f.clamp_limit(),
        offset=f.offset,
    )


@router.get("/{note_id}", response_model=NoteRead)
def get_note_by_id(
    note_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = get_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заметка не найдена")
    return note_orm_to_read(note)


@router.post("/", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_new_note(
    note: NoteCreate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_note = create_note(db, note, current_user.id)
    return note_orm_to_read(db_note)


@router.put("/{note_id}", response_model=NoteRead)
def update_note_by_id(
    note_id: int,
    note: NoteUpdate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_note = update_note(db, note_id, note, current_user.id)
    return note_orm_to_read(db_note)


@router.delete("/{note_id}", status_code=status.HTTP_200_OK)
def delete_note_by_id(
    note_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_note(db, note_id, current_user.id)
    return {"ok": True}
