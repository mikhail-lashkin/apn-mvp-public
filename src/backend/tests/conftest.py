"""
Фикстуры для тестов. Минимальное приложение (auth + notes + live-notes), SQLite in-memory.
Без PostgreSQL — иначе на Windows psycopg2 падает на UnicodeDecodeError.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.db.session import Base, get_db
from src.backend.middleware.rate_limit import limiter
from src.backend.models.board_analysis import BoardAnalysis  # noqa: F401
from src.backend.models.note import NoteORM  # noqa: F401
from src.backend.models.player import PlayerORM  # noqa: F401
from src.backend.models.player_profile import PlayerProfile  # noqa: F401
from src.backend.models.session import SessionORM  # noqa: F401
from src.backend.models.table import TableORM  # noqa: F401
from src.backend.models.template import Template  # noqa: F401
from src.backend.models.user import UserORM  # noqa: F401
from src.backend.routers import auth, live_notes, notes, players


@pytest.fixture(autouse=True)
def _disable_rate_limit_by_default():
    """Shared suite: register/login не упираются в 5/min. Включаем только в test_rate_limiting."""
    limiter.enabled = False
    yield
    limiter.enabled = False


@pytest.fixture(scope="session")
def app():
    """Минимальное приложение для API-тестов (без rate limit на shared app)."""
    _app = FastAPI(title="Test Notes API")
    _app.include_router(auth.router)
    _app.include_router(notes.router)
    _app.include_router(live_notes.router)
    _app.include_router(players.router)

    @_app.get("/")
    def root():
        return {"message": "AI Poker Notes Backend is running"}

    @_app.get("/health")
    def health_check():
        return {"status": "healthy"}

    return _app


@pytest.fixture(scope="function")
def test_engine():
    """Движок SQLite in-memory для тестов (без PostgreSQL)."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def test_conn(test_engine):
    """Одно подключение к in-memory БД: и тест, и запросы используют его (одна БД)."""
    conn = test_engine.connect()
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture(scope="function")
def db(test_engine, test_conn):
    """Сессия БД на test_conn; создание/удаление таблиц."""
    Base.metadata.create_all(bind=test_conn)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=test_conn)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_conn)


@pytest.fixture(scope="function")
def client(app: FastAPI, db):
    """TestClient: запросы используют ту же сессию db (тест и API в одном потоке — видят одни данные)."""
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)
