"""
@file: note_tag_service.py
@description: CRUD справочника быстрых тегов заметки (SC-7)
@created: 2026-07-18
"""

import re
from typing import List, Optional, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.backend.models.note import NoteORM
from src.backend.models.note_tag import NoteTagORM

ALLOWED_GROUPS = {
    "preflop",
    "postflop",
    "bluff_timing",
    "stack",
}


def list_note_tags(db: Session) -> List[NoteTagORM]:
    return (
        db.query(NoteTagORM)
        .order_by(NoteTagORM.sort_order.asc(), NoteTagORM.id.asc())
        .all()
    )


def get_by_code(db: Session, code: str) -> Optional[NoteTagORM]:
    return db.query(NoteTagORM).filter(NoteTagORM.code == code).first()


def get_by_id(db: Session, tag_id: int) -> Optional[NoteTagORM]:
    return db.query(NoteTagORM).filter(NoteTagORM.id == tag_id).first()


def _slugify_code(label: str) -> str:
    ascii_part = re.sub(r"[^a-z0-9]+", "_", label.lower())
    ascii_part = ascii_part.strip("_")[:40]
    return ascii_part or "custom"


def _unique_code(db: Session, base: str) -> str:
    code = base[:80]
    if not get_by_code(db, code):
        return code
    n = 2
    while n < 1000:
        candidate = f"{base[:70]}_{n}"
        if not get_by_code(db, candidate):
            return candidate
        n += 1
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Не удалось сгенерировать уникальный code",
    )


def _next_sort_order(db: Session) -> int:
    mx = db.query(func.max(NoteTagORM.sort_order)).scalar()
    return int(mx or 0) + 1


def create_note_tag(
    db: Session,
    label: str,
    group_id: str,
    code: Optional[str] = None,
) -> NoteTagORM:
    label = (label or "").strip()
    group_id = (group_id or "").strip()
    if len(label) < 1:
        raise HTTPException(status_code=422, detail="label обязателен")
    if group_id not in ALLOWED_GROUPS:
        raise HTTPException(
            status_code=422,
            detail=f"group_id должен быть одним из: {sorted(ALLOWED_GROUPS)}",
        )

    if code and code.strip():
        raw = code.strip()[:80]
        if get_by_code(db, raw):
            raise HTTPException(status_code=409, detail=f"code '{raw}' уже есть")
        final_code = raw
    else:
        final_code = _unique_code(db, _slugify_code(label))

    row = NoteTagORM(
        code=final_code,
        label=label[:80],
        group_id=group_id,
        sort_order=_next_sort_order(db),
        is_system=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_note_tag(db: Session, tag_id: int, **kwargs: Any) -> NoteTagORM:
    row = get_by_id(db, tag_id)
    if not row:
        raise HTTPException(status_code=404, detail="Тег не найден")

    if "label" in kwargs and kwargs["label"] is not None:
        label = str(kwargs["label"]).strip()
        if not label:
            raise HTTPException(status_code=422, detail="label пустой")
        row.label = label[:80]
    if "group_id" in kwargs and kwargs["group_id"] is not None:
        gid = str(kwargs["group_id"]).strip()
        if gid not in ALLOWED_GROUPS:
            raise HTTPException(status_code=422, detail="Некорректный group_id")
        row.group_id = gid
    if "sort_order" in kwargs and kwargs["sort_order"] is not None:
        row.sort_order = int(kwargs["sort_order"])

    # code не меняем — стабильный slug в notes.tags[]
    db.commit()
    db.refresh(row)
    return row


def _strip_tag_from_notes(db: Session, code: str) -> None:
    """Убрать code из JSON-массива notes.tags (SQLite/Postgres JSON)."""
    notes = db.query(NoteORM).filter(NoteORM.tags.isnot(None)).all()
    for note in notes:
        tags = note.tags
        if not isinstance(tags, list):
            continue
        filtered = [t for t in tags if t != code]
        if len(filtered) != len(tags):
            note.tags = filtered


def delete_note_tag(db: Session, tag_id: int) -> None:
    row = get_by_id(db, tag_id)
    if not row:
        raise HTTPException(status_code=404, detail="Тег не найден")

    code = row.code
    _strip_tag_from_notes(db, code)
    db.delete(row)
    db.commit()


def reorder_note_tags(db: Session, items: List[Dict[str, int]]) -> List[NoteTagORM]:
    if not items:
        return list_note_tags(db)

    for item in items:
        tag_id = int(item["id"])
        sort_order = int(item["sort_order"])
        row = get_by_id(db, tag_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Тег id={tag_id} не найден")
        row.sort_order = sort_order

    db.commit()
    return list_note_tags(db)
