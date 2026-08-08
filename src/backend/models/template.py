"""
@file: template.py
@description: Модель для шаблонов заметок из Live Poker Notes
@dependencies: sqlalchemy, datetime
@created: 2025-01-27
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from src.backend.db.session import Base


class Template(Base):
    """Модель шаблона заметки"""
    __tablename__ = "templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(100), nullable=True, index=True)  # board_summary, player_note, situation_note
    fields = Column(JSON, nullable=True)  # Структура полей шаблона
    sections = Column(JSON, nullable=True)  # Структура секций шаблона
    template_content = Column(Text, nullable=False)  # Полный контент шаблона
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Template(name='{self.name}', type='{self.type}')>" 