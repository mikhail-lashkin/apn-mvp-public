"""
@file: note_tags.py
@description: CRUD справочника быстрых тегов заметки (SC-7)
@dependencies: note_tag_service
@created: 2026-07-18
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.backend.db.session import get_db
from src.backend.models.user import UserORM
from src.backend.services import note_tag_service as svc
from src.backend.services.user_service import get_current_user

router = APIRouter(prefix="/note-tags", tags=["note-tags"])


class NoteTagRead(BaseModel):
    id: int
    code: str
    label: str
    group_id: str
    sort_order: int
    is_system: bool

    class Config:
        orm_mode = True


class NoteTagListResponse(BaseModel):
    items: List[NoteTagRead]


class NoteTagCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    group_id: str = Field(..., min_length=1, max_length=40)
    code: Optional[str] = Field(None, max_length=80)


class NoteTagUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=80)
    group_id: Optional[str] = Field(None, min_length=1, max_length=40)
    sort_order: Optional[int] = None


class ReorderItem(BaseModel):
    id: int
    sort_order: int


class ReorderBody(BaseModel):
    items: List[ReorderItem]


def _to_read(row) -> NoteTagRead:
    return NoteTagRead(
        id=row.id,
        code=row.code,
        label=row.label,
        group_id=row.group_id,
        sort_order=row.sort_order,
        is_system=row.is_system,
    )


@router.get("/", response_model=NoteTagListResponse)
def get_note_tags(
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    rows = svc.list_note_tags(db)
    return NoteTagListResponse(items=[_to_read(r) for r in rows])


@router.post("/", response_model=NoteTagRead, status_code=status.HTTP_201_CREATED)
def create_note_tag(
    body: NoteTagCreate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = svc.create_note_tag(
        db, label=body.label, group_id=body.group_id, code=body.code
    )
    return _to_read(row)


@router.put("/reorder", response_model=NoteTagListResponse)
def reorder_note_tags(
    body: ReorderBody,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    rows = svc.reorder_note_tags(
        db, [{"id": i.id, "sort_order": i.sort_order} for i in body.items]
    )
    return NoteTagListResponse(items=[_to_read(r) for r in rows])


@router.put("/{tag_id}", response_model=NoteTagRead)
def update_note_tag(
    tag_id: int,
    body: NoteTagUpdate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = svc.update_note_tag(db, tag_id, **body.dict(exclude_unset=True))
    return _to_read(row)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note_tag(
    tag_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    svc.delete_note_tag(db, tag_id)
    return None
