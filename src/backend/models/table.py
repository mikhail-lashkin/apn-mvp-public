"""
@file: table.py
@description: Модели для покерных столов (Pydantic и ORM)
@dependencies: sqlalchemy, pydantic
@created: 2025-01-30
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from datetime import datetime
from src.backend.db.session import Base

class TableORM(Base):
    """ORM модель покерного стола"""
    __tablename__ = "tables"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    size = Column(Integer, nullable=False)  # 6, 8, 9, 10
    hero_position = Column(Integer, nullable=True)  # Позиция героя (0-9)
    location = Column(String(255), nullable=True)  # Локация казино
    limits = Column(String(100), nullable=True)  # Лимиты (например, "1/2", "2/5")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TableCreate(BaseModel):
    """Схема для создания стола"""
    name: str = Field(..., min_length=1, max_length=255)
    size: int = Field(..., ge=6, le=10, description="Размер стола (6-10 мест)")
    hero_position: Optional[int] = Field(None, ge=0, le=9)
    location: Optional[str] = Field(None, max_length=255)
    limits: Optional[str] = Field(None, max_length=100)

class TableUpdate(BaseModel):
    """Схема для обновления стола"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    size: Optional[int] = Field(None, ge=6, le=10)
    hero_position: Optional[int] = Field(None, ge=0, le=9)
    location: Optional[str] = Field(None, max_length=255)
    limits: Optional[str] = Field(None, max_length=100)

class TableRead(BaseModel):
    """Схема для чтения стола"""
    id: int
    user_id: int
    name: str
    size: int
    hero_position: Optional[int]
    location: Optional[str]
    limits: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
