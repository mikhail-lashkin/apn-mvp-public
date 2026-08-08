"""
@file: session_service.py
@description: Сервис для работы с сессиями (CRUD операции)
@dependencies: sqlalchemy
@created: 2025-01-30
"""

from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException, status
from src.backend.models.session import SessionORM, SessionCreate, SessionUpdate

def create_session(db: Session, session: SessionCreate, user_id: int) -> SessionORM:
    """Создание новой сессии"""
    db_session = SessionORM(
        user_id=user_id,
        table_id=session.table_id,
        buy_in=Decimal(str(session.buy_in)) if session.buy_in else None,
        start_time=session.start_time or datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def get_session(db: Session, session_id: int, user_id: int) -> Optional[SessionORM]:
    """Получение сессии по ID"""
    return db.query(SessionORM).filter(
        SessionORM.id == session_id,
        SessionORM.user_id == user_id
    ).first()

def get_sessions(
    db: Session,
    user_id: int,
    table_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0
) -> List[SessionORM]:
    """Получение списка сессий пользователя"""
    query = db.query(SessionORM).filter(SessionORM.user_id == user_id)
    
    if table_id:
        query = query.filter(SessionORM.table_id == table_id)
    
    return query.order_by(SessionORM.start_time.desc()).offset(offset).limit(limit).all()

def update_session(db: Session, session_id: int, session: SessionUpdate, user_id: int) -> SessionORM:
    """Обновление сессии"""
    db_session = get_session(db, session_id, user_id)
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сессия не найдена"
        )
    
    if session.end_time is not None:
        db_session.end_time = session.end_time
        # Автоматически вычисляем длительность
        if db_session.start_time:
            delta = session.end_time - db_session.start_time
            db_session.duration_minutes = int(delta.total_seconds() / 60)
    
    if session.cash_out is not None:
        db_session.cash_out = Decimal(str(session.cash_out))
        # Автоматически вычисляем прибыль
        if db_session.buy_in:
            db_session.profit = db_session.cash_out - db_session.buy_in
    
    if session.notes_count is not None:
        db_session.notes_count = session.notes_count
    
    db_session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_session)
    return db_session

def delete_session(db: Session, session_id: int, user_id: int) -> bool:
    """Удаление сессии"""
    db_session = get_session(db, session_id, user_id)
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сессия не найдена"
        )
    
    db.delete(db_session)
    db.commit()
    return True

def get_session_statistics(db: Session, user_id: int) -> dict:
    """Получение статистики по сессиям"""
    sessions = db.query(SessionORM).filter(SessionORM.user_id == user_id).all()
    
    total_sessions = len(sessions)
    total_profit = sum([float(s.profit or 0) for s in sessions])
    total_duration = sum([s.duration_minutes or 0 for s in sessions])
    total_notes = sum([s.notes_count or 0 for s in sessions])
    
    return {
        "total_sessions": total_sessions,
        "total_profit": total_profit,
        "total_duration_minutes": total_duration,
        "total_notes": total_notes,
        "average_profit": total_profit / total_sessions if total_sessions > 0 else 0,
        "average_duration_minutes": total_duration / total_sessions if total_sessions > 0 else 0
    }
