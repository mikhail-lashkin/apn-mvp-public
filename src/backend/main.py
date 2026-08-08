"""
@file: main.py
@description: Точка входа FastAPI-приложения для AI Poker Notes. Инициализация приложения, подключение роутеров, настройка middlewares.
@dependencies: routers, db, services
@created: 2024-07-09
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.backend.routers import auth, notes, live_notes, tables, sessions, players, player_tags, note_tags, sync
from src.backend.middleware.rate_limit import setup_rate_limiting

# Примечание: Создание таблиц теперь выполняется через Alembic миграции
# Запустите: alembic upgrade head

app = FastAPI(
    title="AI Poker Notes Backend",
    description="Backend API для приложения AI Poker Notes",
    version="1.0.0"
)

# Настройка rate limiting
app = setup_rate_limiting(app)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(live_notes.router)
app.include_router(tables.router)
app.include_router(sessions.router)
app.include_router(players.router)
app.include_router(player_tags.router)
app.include_router(note_tags.router)
app.include_router(sync.router)

@app.get("/")
def root():
    return {"message": "AI Poker Notes Backend is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"} 