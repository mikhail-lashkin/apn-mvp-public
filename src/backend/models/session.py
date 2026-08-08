"""
@file: session.py
@description: Модели для покерных сессий (Pydantic и ORM)
@dependencies: sqlalchemy, pydantic
@created: 2025-01-30
"""

from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, JSON
from datetime import datetime
from src.backend.db.session import Base

class SessionORM(Base):
    """ORM модель покерной сессии"""
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    buy_in = Column(Numeric(10, 2), nullable=True)  # Стартовый стек
    cash_out = Column(Numeric(10, 2), nullable=True)  # Финальный стек
    profit = Column(Numeric(10, 2), nullable=True)  # Прибыль/убыток
    duration_minutes = Column(Integer, nullable=True)  # Длительность в минутах
    notes_count = Column(Integer, default=0)  # Количество заметок в сессии
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SessionCreate(BaseModel):
    """Схема для создания сессии"""
    table_id: Optional[int] = None
    buy_in: Optional[float] = Field(None, ge=0, description="Стартовый стек")
    start_time: Optional[datetime] = None

class SessionUpdate(BaseModel):
    """Схема для обновления сессии"""
    end_time: Optional[datetime] = None
    cash_out: Optional[float] = Field(None, ge=0, description="Финальный стек")
    notes_count: Optional[int] = Field(None, ge=0)

class SessionRead(BaseModel):
    """Схема для чтения сессии"""
    id: int
    user_id: int
    table_id: Optional[int]
    start_time: datetime
    end_time: Optional[datetime]
    buy_in: Optional[float]
    cash_out: Optional[float]
    profit: Optional[float]
    duration_minutes: Optional[int]
    notes_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
