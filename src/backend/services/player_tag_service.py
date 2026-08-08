"""
@file: player_tag_service.py
@description: CRUD справочника меток игрока (SC-6)
@created: 2026-07-15
@updated: 2026-07-17
"""

import re
from typing import List, Optional, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.backend.models.player import PlayerORM
from src.backend.models.player_tag import PlayerTagORM


def list_player_tags(db: Session) -> List[PlayerTagORM]:
    return (
        db.query(PlayerTagORM)
        .order_by(PlayerTagORM.sort_order.asc(), PlayerTagORM.id.asc())
        .all()
    )


def get_by_code(db: Session, code: str) -> Optional[PlayerTagORM]:
    return db.query(PlayerTagORM).filter(PlayerTagORM.code == code).first()


def get_by_id(db: Session, tag_id: int) -> Optional[PlayerTagORM]:
    return db.query(PlayerTagORM).filter(PlayerTagORM.id == tag_id).first()


def _slugify_code(label: str) -> str:
    # ascii slug; эмодзи/кириллица → пусто → custom
    ascii_part = re.sub(r"[^a-z0-9]+", "_", label.lower())
    ascii_part = ascii_part.strip("_")[:30]
    return ascii_part or "custom"


def _unique_code(db: Session, base: str) -> str:
    code = base[:40]
    if not get_by_code(db, code):
        return code
    n = 2
    while n < 1000:
        candidate = f"{base[:35]}_{n}"
        if not get_by_code(db, candidate):
            return candidate
        n += 1
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Не удалось сгенерировать уникальный code",
    )


def _next_sort_order(db: Session) -> int:
    mx = db.query(func.max(PlayerTagORM.sort_order)).scalar()
    return int(mx or 0) + 1


def create_player_tag(
    db: Session,
    label: str,
    color: str,
    code: Optional[str] = None,
) -> PlayerTagORM:
    label = (label or "").strip()
    color = (color or "").strip()
    if len(label) < 1:
        raise HTTPException(status_code=422, detail="label обязателен")
    if not re.match(r"^#[0-9A-Fa-f]{6}$", color):
        raise HTTPException(status_code=422, detail="color должен быть hex #RRGGBB")

    if code and code.strip():
        raw = code.strip().lower().replace("-", "_").replace(" ", "_")
        raw = re.sub(r"[^a-z0-9_]", "", raw)[:40]
        if not raw:
            raise HTTPException(status_code=422, detail="Некорректный code")
        if get_by_code(db, raw):
            raise HTTPException(status_code=409, detail=f"code '{raw}' уже есть")
        final_code = raw
    else:
        final_code = _unique_code(db, _slugify_code(label))

    row = PlayerTagORM(
        code=final_code,
        label=label[:80],
        color=color,
        sort_order=_next_sort_order(db),
        is_system=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_player_tag(
    db: Session,
    tag_id: int,
    **kwargs: Any,
) -> PlayerTagORM:
    row = get_by_id(db, tag_id)
    if not row:
        raise HTTPException(status_code=404, detail="Метка не найдена")

    if "label" in kwargs and kwargs["label"] is not None:
        label = str(kwargs["label"]).strip()
        if not label:
            raise HTTPException(status_code=422, detail="label пустой")
        row.label = label[:80]
    if "color" in kwargs and kwargs["color"] is not None:
        color = str(kwargs["color"]).strip()
        if not re.match(r"^#[0-9A-Fa-f]{6}$", color):
            raise HTTPException(status_code=422, detail="color должен быть hex #RRGGBB")
        row.color = color
    if "sort_order" in kwargs and kwargs["sort_order"] is not None:
        row.sort_order = int(kwargs["sort_order"])

    # code не меняем — стабильный slug в players.player_tag
    db.commit()
    db.refresh(row)
    return row


def delete_player_tag(db: Session, tag_id: int) -> None:
    row = get_by_id(db, tag_id)
    if not row:
        raise HTTPException(status_code=404, detail="Метка не найдена")

    code = row.code
    db.query(PlayerORM).filter(PlayerORM.player_tag == code).update(
        {"player_tag": "unknown", "tag_color": None},
        synchronize_session=False,
    )
    db.delete(row)
    db.commit()


def reorder_player_tags(db: Session, items: List[Dict[str, int]]) -> List[PlayerTagORM]:
    """items: [{id, sort_order}, ...]"""
    if not items:
        return list_player_tags(db)

    for item in items:
        tag_id = int(item["id"])
        sort_order = int(item["sort_order"])
        row = get_by_id(db, tag_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Метка id={tag_id} не найдена")
        row.sort_order = sort_order

    db.commit()
    return list_player_tags(db)
