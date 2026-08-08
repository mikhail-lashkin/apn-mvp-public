"""
@file: tables.py
@description: Роутер для CRUD операций со столами
@dependencies: fastapi, table_service
@created: 2025-01-30
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from src.backend.models.table import TableCreate, TableUpdate, TableRead
from src.backend.services.table_service import (
    create_table, get_table, get_tables, update_table, delete_table
)
from src.backend.services.user_service import get_current_user
from src.backend.models.user import UserORM
from src.backend.db.session import get_db

router = APIRouter(prefix="/tables", tags=["tables"])

class TableListResponse(BaseModel):
    items: List[TableRead]
    total: int
    limit: int
    offset: int

def table_orm_to_read(table_orm) -> TableRead:
    """Преобразование ORM модели в Pydantic модель"""
    return TableRead(
        id=table_orm.id,
        user_id=table_orm.user_id,
        name=table_orm.name,
        size=table_orm.size,
        hero_position=table_orm.hero_position,
        location=table_orm.location,
        limits=table_orm.limits,
        created_at=table_orm.created_at,
        updated_at=table_orm.updated_at
    )

@router.get("/", response_model=TableListResponse)
def get_tables_list(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка столов пользователя"""
    tables = get_tables(db, current_user.id, limit, offset)
    total = len(tables)  # Упрощенная версия, в production нужен count query
    
    return TableListResponse(
        items=[table_orm_to_read(table) for table in tables],
        total=total,
        limit=limit,
        offset=offset
    )

@router.get("/{table_id}", response_model=TableRead)
def get_table_by_id(
    table_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение стола по ID"""
    table = get_table(db, table_id, current_user.id)
    if not table:
        raise HTTPException(status_code=404, detail="Стол не найден")
    return table_orm_to_read(table)

@router.post("/", response_model=TableRead, status_code=status.HTTP_201_CREATED)
def create_new_table(
    table: TableCreate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание нового стола"""
    db_table = create_table(db, table, current_user.id)
    return table_orm_to_read(db_table)

@router.put("/{table_id}", response_model=TableRead)
def update_table_by_id(
    table_id: int,
    table: TableUpdate,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление стола"""
    db_table = update_table(db, table_id, table, current_user.id)
    return table_orm_to_read(db_table)

@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table_by_id(
    table_id: int,
    current_user: UserORM = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление стола"""
    delete_table(db, table_id, current_user.id)
    return None
