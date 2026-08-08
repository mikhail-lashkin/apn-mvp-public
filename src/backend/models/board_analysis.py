"""
@file: board_analysis.py
@description: Модель для анализа раздач из Live Poker Notes
@dependencies: sqlalchemy, datetime
@created: 2025-01-27
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from src.backend.db.session import Base


class BoardAnalysis(Base):
    """Модель анализа раздачи"""
    __tablename__ = "board_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(50), nullable=True, index=True)
    spot = Column(String(100), nullable=True, index=True)  # SRP IP PFR, 3BP OOP PFC, etc.
    board_texture = Column(String(100), nullable=True, index=True)  # Paired, Monotone, etc.
    flop = Column(String(50), nullable=True)  # 6c4c3c, K95m, etc.
    gto_baseline = Column(JSON, nullable=True)  # GTO Baseline данные
    simplified_strategy = Column(JSON, nullable=True)  # Упрощенная стратегия
    exploit_adaptation = Column(JSON, nullable=True)  # Эксплойт адаптация
    live_notes = Column(JSON, nullable=True)  # Live notes
    content = Column(Text, nullable=False)  # Полный контент анализа
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<BoardAnalysis(spot='{self.spot}', flop='{self.flop}')>" 