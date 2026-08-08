"""
@file: table_service.py
@description: Сервис для работы со столами (CRUD операции)
@dependencies: sqlalchemy
@created: 2025-01-30
"""

from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from fastapi import HTTPException, status
from src.backend.models.table import TableORM, TableCreate, TableUpdate

def create_table(db: Session, table: TableCreate, user_id: int) -> TableORM:
    """Создание нового стола"""
    db_table = TableORM(
        user_id=user_id,
        name=table.name,
        size=table.size,
        hero_position=table.hero_position,
        location=table.location,
        limits=table.limits,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(db_table)
    db.commit()
    db.refresh(db_table)
    return db_table

def get_table(db: Session, table_id: int, user_id: int) -> Optional[TableORM]:
    """Получение стола по ID"""
    return db.query(TableORM).filter(
        TableORM.id == table_id,
        TableORM.user_id == user_id
    ).first()

def get_tables(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> List[TableORM]:
    """Получение списка столов пользователя"""
    return db.query(TableORM).filter(
        TableORM.user_id == user_id
    ).order_by(TableORM.created_at.desc()).offset(offset).limit(limit).all()

def update_table(db: Session, table_id: int, table: TableUpdate, user_id: int) -> TableORM:
    """Обновление стола"""
    db_table = get_table(db, table_id, user_id)
    if not db_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Стол не найден"
        )
    
    if table.name is not None:
        db_table.name = table.name
    if table.size is not None:
        db_table.size = table.size
    if table.hero_position is not None:
        db_table.hero_position = table.hero_position
    if table.location is not None:
        db_table.location = table.location
    if table.limits is not None:
        db_table.limits = table.limits
    
    db_table.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_table)
    return db_table

def delete_table(db: Session, table_id: int, user_id: int) -> bool:
    """Удаление стола"""
    db_table = get_table(db, table_id, user_id)
    if not db_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Стол не найден"
        )
    
    db.delete(db_table)
    db.commit()
    return True
