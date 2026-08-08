"""
@file: test_auth_integration.py
@description: FB-8 — сквозной flow: регистрация → логин → защищённые endpoints → refresh
@dependencies: conftest (SQLite in-memory, auth + notes routers)
@created: 2026-07-15
"""

from datetime import timedelta

from src.backend.services.security import create_access_token


def _register(client, email: str, password: str = "securepass123"):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Integration User",
        },
    )


def _login(client, email: str, password: str = "securepass123"):
    return client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )


def test_register_login_me_create_note_flow(client):
    """Регистрация → логин → /auth/me → POST /notes → 401 без токена."""
    email = "fb8-flow@example.com"

    reg = _register(client, email)
    assert reg.status_code == 200
    assert reg.json()["email"] == email

    login = _login(client, email)
    assert login.status_code == 200
    tokens = login.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == email

    note = client.post(
        "/notes/",
        json={"text": "FB-8 integration note", "tags": ["fb8", "test"]},
        headers=headers,
    )
    assert note.status_code == 201
    body = note.json()
    assert body["text"] == "FB-8 integration note"
    assert set(body["tags"]) == {"fb8", "test"}

    unauth = client.post(
        "/notes/",
        json={"text": "Should fail", "tags": []},
    )
    assert unauth.status_code == 403


def test_expired_access_token_refresh_then_protected_endpoint(client):
    """Протухший access + валидный refresh → новый access → POST /notes 201."""
    email = "fb8-refresh@example.com"

    _register(client, email)
    login = _login(client, email)
    refresh_token = login.json()["refresh_token"]

    expired_access = create_access_token(
        data={"sub": email},
        expires_delta=timedelta(seconds=-60),
    )

    stale = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_access}"},
    )
    assert stale.status_code == 401

    refreshed = client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()
    assert "access_token" in new_tokens
    assert new_tokens["access_token"] != expired_access

    note = client.post(
        "/notes/",
        json={"text": "After refresh", "tags": ["refresh"]},
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert note.status_code == 201
    assert note.json()["text"] == "After refresh"


def test_login_invalid_credentials_after_register(client):
    """Логин с неверным паролем → 401 (negative path в том же flow)."""
    email = "fb8-bad-login@example.com"
    _register(client, email)

    bad = _login(client, email, password="wrong-password")
    assert bad.status_code == 401
