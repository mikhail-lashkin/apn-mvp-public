"""
@file: init_db.py
@description: Инициализация таблиц в базе данных для FastAPI backend (создание всех моделей).
@dependencies: sqlalchemy, models
@created: 2024-07-09
"""

from .session import engine
from src.backend.models.user import UserORM
from src.backend.models.note import NoteORM
from src.backend.models.player_profile import PlayerProfile
from src.backend.models.board_analysis import BoardAnalysis
from src.backend.models.template import Template

# Импортируем Base из одной из моделей (все используют один Base)
from src.backend.models.user import Base

# Создание всех таблиц
Base.metadata.create_all(bind=engine) 