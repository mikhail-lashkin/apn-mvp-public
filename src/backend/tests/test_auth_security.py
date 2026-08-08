"""
@file: test_auth_security.py
@description: Тесты безопасности auth (SQLite via conftest, без PostgreSQL)
@dependencies: conftest client/db
@created: 2025-01-30
@updated: 2026-07-18
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from src.backend.db.session import Base, get_db
from src.backend.middleware.rate_limit import limiter, setup_rate_limiting
from src.backend.models.user import UserORM
from src.backend.routers import auth
from src.backend.services.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_token,
)


@pytest.fixture
def test_user(db: Session):
    user = UserORM(
        email="sec-user@example.com",
        hashed_password=get_password_hash("testpassword123"),
        full_name="Test User",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_register_success(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "securepassword123",
            "full_name": "New User",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data


def test_register_duplicate_email(client, test_user):
    response = client.post(
        "/auth/register",
        json={
            "email": test_user.email,
            "password": "password123",
            "full_name": "Duplicate User",
        },
    )
    assert response.status_code == 400


def test_login_success(client, test_user):
    response = client.post(
        "/auth/login",
        data={
            "username": test_user.email,
            "password": "testpassword123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials(client, test_user):
    response = client.post(
        "/auth/login",
        data={
            "username": test_user.email,
            "password": "wrongpassword",
        },
    )
    assert response.status_code == 401


def test_refresh_token_success(client, test_user):
    login_response = client.post(
        "/auth/login",
        data={
            "username": test_user.email,
            "password": "testpassword123",
        },
    )
    refresh_token = login_response.json()["refresh_token"]

    response = client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_refresh_token_invalid(client):
    response = client.post(
        "/auth/refresh",
        json={"refresh_token": "invalid_token"},
    )
    assert response.status_code == 401


def test_get_me_success(client, test_user):
    login_response = client.post(
        "/auth/login",
        data={
            "username": test_user.email,
            "password": "testpassword123",
        },
    )
    access_token = login_response.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == test_user.email


def test_get_me_invalid_token(client):
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token"},
    )
    assert response.status_code == 401


def test_token_verification():
    access_token = create_access_token(data={"sub": "test@example.com"})
    payload = verify_token(access_token, token_type="access")
    assert payload is not None
    assert payload["sub"] == "test@example.com"
    assert payload["type"] == "access"

    refresh_token = create_refresh_token(data={"sub": "test@example.com"})
    payload = verify_token(refresh_token, token_type="refresh")
    assert payload is not None
    assert payload["sub"] == "test@example.com"
    assert payload["type"] == "refresh"

    # неверный тип токена
    assert verify_token(access_token, token_type="refresh") is None


def test_rate_limiting(test_conn):
    """Изолированное app + явный enable limiter (autouse в conftest его гасит)."""
    Base.metadata.create_all(bind=test_conn)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=test_conn)
    session = Session()

    limited_app = FastAPI(title="Rate Limit Test")
    limited_app = setup_rate_limiting(limited_app)
    limited_app.include_router(auth.router)

    def override_get_db():
        yield session

    limited_app.dependency_overrides[get_db] = override_get_db
    limiter.reset()
    limiter.enabled = True

    try:
        with TestClient(limited_app) as rate_client:
            last = None
            for i in range(6):
                last = rate_client.post(
                    "/auth/register",
                    json={
                        "email": f"ratelimit{i}@example.com",
                        "password": "password123",
                        "full_name": f"User {i}",
                    },
                )
            assert last is not None
            assert last.status_code == 429
    finally:
        limiter.enabled = False
        limited_app.dependency_overrides.pop(get_db, None)
        session.close()
        Base.metadata.drop_all(bind=test_conn)
