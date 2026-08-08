"""
@file: sessions.py
@description: Роутер для CRUD операций с сессиями
@dependencies: fastapi, session_service
@created: 2025-01-30
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from src.backend.models.session import SessionCreate, SessionUpdate, SessionRead
from src.backend.services.session_service import (
    create_session, get_session, get_sessions, update_session, delete_session, get_session_statistics
)
from src.backend.services.user_service import get_current_user
from src.backend.models.user import UserORM
from src.backend.db.session import get_db

router = APIRouter(prefix="/sessions", tags=["sessions"])

class SessionListResponse(BaseModel):
    items: List[SessionRead]
    total: int
    limit: int
    offset: int

class SessionStatisticsResponse(BaseModel):
    total_sessions: int
    total_profit: float
    total_duration_minutes: int
    total_notes: int
    average_profit: float
    average_duration_minutes: float

def session_orm_to_read(session_orm) -> SessionRead:
    """Преобразование ORM модели в Pydantic модель"""
    return SessionRead(
        id=session_orm.id,
        user_id=session_orm.user_id,
        table_id=session_orm.table_id,
        start_time=session_orm.start_time,
        end_time=session_orm.end_time,
        buy_in=float(session_orm.buy_in) if session_orm.buy_in else None,
        cash_out=float(session_orm.cash_out) if session_orm.cash_out else None,
        profit=float(session_orm.profit) if session_orm.profit else None,
        duration_minutes=session_orm.duration_minutes,
        notes_count=session_orm.notes_count,
        created_at=session_orm.created_at,
        updated_at=session_orm.updated_at
    )

@router.get("/", response_model=SessionListResponse)
def get_sessions_list(
    table_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка сессий пользователя"""
    sessions = get_sessions(db, current_user.id, table_id, limit, offset)
    total = len(sessions)  # Упрощенная версия
    
    return SessionListResponse(
        items=[session_orm_to_read(session) for session in sessions],
        total=total,
        limit=limit,
        offset=offset
    )

@router.get("/statistics", response_model=SessionStatisticsResponse)
def get_statistics(
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики по сессиям"""
    stats = get_session_statistics(db, current_user.id)
    return SessionStatisticsResponse(**stats)

@router.get("/{session_id}", response_model=SessionRead)
def get_session_by_id(
    session_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение сессии по ID"""
    session = get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    return session_orm_to_read(session)

@router.post("/", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create_new_session(
    session: SessionCreate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание новой сессии"""
    db_session = create_session(db, session, current_user.id)
    return session_orm_to_read(db_session)

@router.put("/{session_id}", response_model=SessionRead)
def update_session_by_id(
    session_id: int,
    session: SessionUpdate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление сессии"""
    db_session = update_session(db, session_id, session, current_user.id)
    return session_orm_to_read(db_session)

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session_by_id(
    session_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление сессии"""
    delete_session(db, session_id, current_user.id)
    return None
