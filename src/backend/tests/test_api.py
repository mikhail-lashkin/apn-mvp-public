"""
@file: test_api.py
@description: Базовые smoke-тесты API (SQLite via conftest, без PostgreSQL)
@dependencies: conftest client
@created: 2025-01-27
@updated: 2026-07-18
"""


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "AI Poker Notes Backend is running"}


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_auth_endpoints(client):
    user_data = {
        "email": "api-smoke@example.com",
        "password": "testpassword123",
        "full_name": "Test User",
    }
    response = client.post("/auth/register", json=user_data)
    assert response.status_code == 200
    assert response.json()["email"] == user_data["email"]

    login_data = {
        "username": "api-smoke@example.com",
        "password": "testpassword123",
    }
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_notes_endpoints(client):
    user_data = {
        "email": "api-notes@example.com",
        "password": "testpassword123",
        "full_name": "Test User 2",
    }
    client.post("/auth/register", json=user_data)

    login_response = client.post(
        "/auth/login",
        data={
            "username": "api-notes@example.com",
            "password": "testpassword123",
        },
    )
    token = login_response.json()["access_token"]

    note_data = {"text": "Test note", "tags": ["test", "poker"]}
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/notes/", json=note_data, headers=headers)
    assert response.status_code == 201
    assert response.json()["text"] == "Test note"


def test_live_notes_endpoints(client):
    response = client.get("/live-notes/statistics")
    assert response.status_code == 200
    body = response.json()
    assert "templates_count" in body
    assert body["templates_count"] == 0
