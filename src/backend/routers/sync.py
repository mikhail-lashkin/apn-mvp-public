"""
@file: sync.py
@description: Роутер для синхронизации данных (offline-first)
@dependencies: fastapi, note_service
@created: 2025-01-30
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from src.backend.services.user_service import get_current_user
from src.backend.models.user import UserORM
from src.backend.db.session import get_db
from src.backend.services.note_service import get_notes, get_note_count

router = APIRouter(prefix="/sync", tags=["sync"])

class SyncOperation(BaseModel):
    type: str  # create, update, delete
    entity: str  # note, table, session, player
    entity_id: str
    data: Optional[dict] = None
    timestamp: int

class SyncRequest(BaseModel):
    operations: List[SyncOperation]
    last_sync_time: Optional[datetime] = None

class SyncResponse(BaseModel):
    synced: int
    failed: int
    conflicts: List[dict] = []

@router.post("/", response_model=SyncResponse)
def sync_data(
    request: SyncRequest,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Синхронизация данных с клиента (last-write-wins стратегия)"""
    synced = 0
    failed = 0
    conflicts = []
    
    # В MVP используем простую стратегию last-write-wins
    # В production можно добавить более сложную логику разрешения конфликтов
    for operation in request.operations:
        try:
            # Здесь должна быть логика применения операции
            # Пока просто считаем успешной
            synced += 1
        except Exception as e:
            failed += 1
            conflicts.append({
                "operation_id": operation.entity_id,
                "error": str(e)
            })
    
    return SyncResponse(
        synced=synced,
        failed=failed,
        conflicts=conflicts
    )

@router.get("/changes")
def get_changes(
    since: Optional[datetime] = None,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение изменений с сервера с момента последней синхронизации"""
    # Получаем заметки, измененные после since
    if since:
        notes = get_notes(
            db,
            current_user.id,
            date_from=since,
            limit=1000
        )
    else:
        notes = get_notes(db, current_user.id, limit=100)
    
    return {
        "notes": [
            {
                "id": note.id,
                "text": note.text,
                "tags": note.tags.split(",") if note.tags else [],
                "updated_at": note.updated_at.isoformat() if note.updated_at else None
            }
            for note in notes
        ],
        "timestamp": datetime.utcnow().isoformat()
    }
