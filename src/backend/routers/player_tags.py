"""
@file: player_tags.py
@description: CRUD справочника меток игрока (ColorSystem). SC-6 шаг 2.
@dependencies: player_tag_service
@created: 2026-07-15
@updated: 2026-07-17
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.backend.db.session import get_db
from src.backend.models.user import UserORM
from src.backend.services import player_tag_service as svc
from src.backend.services.user_service import get_current_user

router = APIRouter(prefix="/player-tags", tags=["player-tags"])


class PlayerTagRead(BaseModel):
    id: int
    code: str
    label: str
    color: str
    sort_order: int
    is_system: bool

    class Config:
        orm_mode = True


class PlayerTagListResponse(BaseModel):
    items: List[PlayerTagRead]


class PlayerTagCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    color: str = Field(..., min_length=7, max_length=20)
    code: Optional[str] = Field(None, max_length=40)


class PlayerTagUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=80)
    color: Optional[str] = Field(None, min_length=7, max_length=20)
    sort_order: Optional[int] = None


class ReorderItem(BaseModel):
    id: int
    sort_order: int


class ReorderBody(BaseModel):
    items: List[ReorderItem]


def _to_read(row) -> PlayerTagRead:
    return PlayerTagRead(
        id=row.id,
        code=row.code,
        label=row.label,
        color=row.color,
        sort_order=row.sort_order,
        is_system=row.is_system,
    )


@router.get("/", response_model=PlayerTagListResponse)
def get_player_tags(
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    rows = svc.list_player_tags(db)
    return PlayerTagListResponse(items=[_to_read(r) for r in rows])


@router.post("/", response_model=PlayerTagRead, status_code=status.HTTP_201_CREATED)
def create_player_tag(
    body: PlayerTagCreate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = svc.create_player_tag(db, label=body.label, color=body.color, code=body.code)
    return _to_read(row)


@router.put("/reorder", response_model=PlayerTagListResponse)
def reorder_player_tags(
    body: ReorderBody,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    rows = svc.reorder_player_tags(
        db, [{"id": i.id, "sort_order": i.sort_order} for i in body.items]
    )
    return PlayerTagListResponse(items=[_to_read(r) for r in rows])


@router.put("/{tag_id}", response_model=PlayerTagRead)
def update_player_tag(
    tag_id: int,
    body: PlayerTagUpdate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = svc.update_player_tag(
        db,
        tag_id,
        **body.dict(exclude_unset=True),
    )
    return _to_read(row)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player_tag(
    tag_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    svc.delete_player_tag(db, tag_id)
    return None
