"""
@file: players.py
@description: Роутер для CRUD операций с профилями игроков
@dependencies: fastapi, player_service
@created: 2025-01-30
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from src.backend.services.player_service import (
    create_player_profile,
    get_player_profile,
    search_players,
    get_player_statistics,
    update_player_profile,
    delete_player_profile,
    count_players,
)
from src.backend.services.ml.recommendation_service import get_player_recommendation
from src.backend.schemas.player_profile_ml import (
    PlayerProfileMl,
    RecommendationRequest,
)
from src.backend.services.user_service import get_current_user
from src.backend.models.user import UserORM
from src.backend.db.session import get_db

router = APIRouter(prefix="/players", tags=["players"])

class PlayerCreate(BaseModel):
    name: str
    style: Optional[str] = None
    content: str = ""
    patterns: Optional[list] = None
    leaks: Optional[list] = None
    exploits: Optional[list] = None
    traps: Optional[list] = None
    regions: Optional[list] = None
    tags: Optional[list] = None

class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    style: Optional[str] = None
    content: Optional[str] = None
    patterns: Optional[list] = None
    leaks: Optional[list] = None
    exploits: Optional[list] = None
    traps: Optional[list] = None
    regions: Optional[list] = None
    tags: Optional[list] = None

class PlayerRead(BaseModel):
    id: int
    name: str
    style: Optional[str]
    patterns: Optional[list]
    leaks: Optional[list]
    exploits: Optional[list]
    traps: Optional[list]
    regions: Optional[list]
    tags: Optional[list]
    content: str
    created_at: str
    updated_at: Optional[str]

    class Config:
        orm_mode = True

class PlayerListResponse(BaseModel):
    items: List[PlayerRead]
    total: int
    limit: int
    offset: int

class PlayerStatisticsResponse(BaseModel):
    player_id: int
    name: str
    style: Optional[str]
    notes_count: int
    patterns_count: int
    leaks_count: int

def player_orm_to_read(player_orm) -> PlayerRead:
    """PlayerORM → ответ API (совместимость с mobile playersApi)."""
    tag = (player_orm.player_tag or "unknown").lower()
    return PlayerRead(
        id=player_orm.id,
        name=player_orm.name,
        style=tag,
        patterns=None,
        leaks=None,
        exploits=None,
        traps=None,
        regions=None,
        # SC-6: slug справочника (lowercase), не UPPER enum
        tags=[tag] if tag != "unknown" else [],
        content="",
        created_at=str(player_orm.created_at),
        updated_at=str(player_orm.updated_at) if player_orm.updated_at else None,
    )

@router.get("/", response_model=PlayerListResponse)
def get_players_list(
    search: Optional[str] = Query(None, description="Поисковый запрос"),
    style: Optional[str] = Query(None, description="Фильтр по стилю"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка игроков с поиском и фильтрацией"""
    players = search_players(db, current_user.id, search, style, limit, offset)
    total = count_players(db, current_user.id, search, style)
    
    return PlayerListResponse(
        items=[player_orm_to_read(player) for player in players],
        total=total,
        limit=limit,
        offset=offset
    )

@router.get("/{player_id}", response_model=PlayerRead)
def get_player_by_id(
    player_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение игрока по ID"""
    player = get_player_profile(db, player_id, user_id=current_user.id)
    if not player:
        raise HTTPException(status_code=404, detail="Игрок не найден")
    return player_orm_to_read(player)

@router.get("/{player_id}/statistics", response_model=PlayerStatisticsResponse)
def get_player_stats(
    player_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики по игроку"""
    stats = get_player_statistics(db, player_id, current_user.id)
    return PlayerStatisticsResponse(**stats)


@router.post(
    "/{player_id}/recommendation",
    response_model=PlayerProfileMl,
    summary="ML-1: рекомендация по линии (rule + LLM)",
)
def post_player_recommendation(
    player_id: int,
    body: Optional[RecommendationRequest] = None,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Hybrid: ColorSystem rule baseline + optional LLM (Opencode Go / DeepSeek).
    Не блокирует сохранение заметки — вызывается по явному запросу.
    """
    req = body or RecommendationRequest()
    try:
        return get_player_recommendation(
            db,
            player_id,
            current_user.id,
            force_refresh=req.force_refresh,
            provider_override=req.provider,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Игрок не найден")

@router.post("/", response_model=PlayerRead, status_code=status.HTTP_201_CREATED)
def create_new_player(
    player: PlayerCreate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание нового профиля игрока"""
    db_player = create_player_profile(
        db,
        user_id=current_user.id,
        name=player.name,
        style=player.style,
        content=player.content,
        patterns=player.patterns,
        leaks=player.leaks,
        exploits=player.exploits,
        traps=player.traps,
        regions=player.regions,
        tags=player.tags,
    )
    return player_orm_to_read(db_player)

@router.put("/{player_id}", response_model=PlayerRead)
def update_player_by_id(
    player_id: int,
    player: PlayerUpdate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление профиля игрока"""
    update_data = player.dict(exclude_unset=True)
    db_player = update_player_profile(db, player_id, current_user.id, **update_data)
    return player_orm_to_read(db_player)

@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player_by_id(
    player_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление профиля игрока"""
    delete_player_profile(db, player_id, current_user.id)
    return None
