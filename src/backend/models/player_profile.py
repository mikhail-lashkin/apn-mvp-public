"""
@file: player_profile.py
@description: Модель для профилей игроков из Live Poker Notes
@dependencies: sqlalchemy, datetime
@created: 2025-01-27
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from src.backend.db.session import Base


class PlayerProfile(Base):
    """Модель профиля игрока"""
    __tablename__ = "player_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    style = Column(String(100), nullable=True, index=True)  # F, P, Agr, Fish, Nit, etc.
    patterns = Column(JSON, nullable=True)  # Список паттернов поведения
    leaks = Column(JSON, nullable=True)  # Список уязвимостей
    exploits = Column(JSON, nullable=True)  # Список эксплойтов
    traps = Column(JSON, nullable=True)  # Список ловушек
    regions = Column(JSON, nullable=True)  # Список регионов
    tags = Column(JSON, nullable=True)  # Список тегов
    content = Column(Text, nullable=False)  # Полный контент профиля
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<PlayerProfile(name='{self.name}', style='{self.style}')>" 