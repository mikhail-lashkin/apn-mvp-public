"""
@file: player_service.py
@description: CRUD игроков за столом (PlayerORM) для Notes API
@dependencies: sqlalchemy
@created: 2025-01-30
@updated: 2026-07-13
"""

from typing import List, Optional, Dict

from fastapi import HTTPException, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from src.backend.constants.color_system import normalize_player_tag_code
from src.backend.models.note import NoteORM
from src.backend.models.player import PlayerORM
from src.backend.services.player_tag_service import get_by_code


def _normalize_player_tag(tags: Optional[list]) -> str:
    """Single-select: берём первый тег, маппим legacy → ColorSystem slug."""
    if not tags:
        return "unknown"
    first = tags[0]
    if isinstance(first, str) and first.strip():
        return normalize_player_tag_code(first)
    return "unknown"


def _apply_tag_color(db: Session, player: PlayerORM) -> None:
    row = get_by_code(db, player.player_tag)
    player.tag_color = row.color if row else None


def create_player_profile(
    db: Session,
    user_id: int,
    name: str,
    style: Optional[str] = None,
    content: str = "",
    **kwargs,
) -> PlayerORM:
    """Создание игрока в таблице players (FK для notes)."""
    del style, content  # legacy поля API, в ORM не храним

    player = PlayerORM(
        user_id=user_id,
        name=name.strip(),
        player_tag=_normalize_player_tag(kwargs.get("tags")),
    )
    _apply_tag_color(db, player)
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


def get_player_profile(
    db: Session, player_id: int, user_id: Optional[int] = None
) -> Optional[PlayerORM]:
    query = db.query(PlayerORM).filter(
        PlayerORM.id == player_id,
        PlayerORM.is_deleted.is_(False),
    )
    if user_id is not None:
        query = query.filter(PlayerORM.user_id == user_id)
    return query.first()


def search_players(
    db: Session,
    user_id: int,
    search_query: Optional[str] = None,
    style: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[PlayerORM]:
    query = db.query(PlayerORM).filter(
        PlayerORM.user_id == user_id,
        PlayerORM.is_deleted.is_(False),
    )

    if search_query:
        query = query.filter(
            or_(
                PlayerORM.name.ilike(f"%{search_query}%"),
                PlayerORM.nickname.ilike(f"%{search_query}%"),
            )
        )

    if style:
        query = query.filter(PlayerORM.player_tag == style.lower())

    return query.order_by(PlayerORM.name).offset(offset).limit(limit).all()


def count_players(
    db: Session,
    user_id: int,
    search_query: Optional[str] = None,
    style: Optional[str] = None,
) -> int:
    query = db.query(func.count(PlayerORM.id)).filter(
        PlayerORM.user_id == user_id,
        PlayerORM.is_deleted.is_(False),
    )
    if search_query:
        query = query.filter(PlayerORM.name.ilike(f"%{search_query}%"))
    if style:
        query = query.filter(PlayerORM.player_tag == style.lower())
    return query.scalar() or 0


def get_player_statistics(db: Session, player_id: int, user_id: int) -> Dict:
    profile = get_player_profile(db, player_id, user_id=user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Игрок не найден")

    notes_count = (
        db.query(func.count(NoteORM.id))
        .filter(
            NoteORM.player_id == player_id,
            NoteORM.user_id == user_id,
            NoteORM.is_deleted.is_(False),
        )
        .scalar()
        or 0
    )

    return {
        "player_id": player_id,
        "name": profile.name,
        "style": profile.player_tag,
        "notes_count": notes_count,
        "patterns_count": 0,
        "leaks_count": 0,
    }


def update_player_profile(
    db: Session, player_id: int, user_id: int, **kwargs
) -> PlayerORM:
    profile = get_player_profile(db, player_id, user_id=user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Игрок не найден")

    if "name" in kwargs and kwargs["name"] is not None:
        profile.name = kwargs["name"].strip()
    if "tags" in kwargs and kwargs["tags"] is not None:
        profile.player_tag = _normalize_player_tag(kwargs["tags"])
        _apply_tag_color(db, profile)

    db.commit()
    db.refresh(profile)
    return profile


def delete_player_profile(db: Session, player_id: int, user_id: int) -> bool:
    profile = get_player_profile(db, player_id, user_id=user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Игрок не найден")

    profile.is_deleted = True
    db.commit()
    return True
