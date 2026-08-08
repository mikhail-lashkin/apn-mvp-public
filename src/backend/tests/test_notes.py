"""
Smoke-тесты Notes API (8 по ТЗ): create, validation, list, filter by player, get by id, other user 404, update, soft delete.
"""

import pytest
from sqlalchemy.orm import Session

from src.backend.models.note import NoteORM
from src.backend.models.player import PlayerORM
from src.backend.models.user import UserORM
from src.backend.services.security import create_access_token

# client, db — из conftest (SQLite in-memory)
# Хеш пароля для тестов: не вызываем get_password_hash из-за возможных проблем с bcrypt в окружении
TEST_PASSWORD_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYqGqRZ.pKi2"  # testpassword123


@pytest.fixture
def test_user(db: Session):
    user = UserORM(
        email="test@example.com",
        hashed_password=TEST_PASSWORD_HASH,
        full_name="Test User",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user):
    return create_access_token(data={"sub": test_user.email})


def test_create_note_success(client, db, test_user, auth_token):
    """POST /notes валидные данные → 201, тело NoteRead."""
    response = client.post(
        "/notes/",
        json={"text": "Тестовая заметка", "tags": ["тег1", "тег2"]},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["text"] == "Тестовая заметка"
    assert set(data["tags"]) == {"тег1", "тег2"}
    assert data["user_id"] == test_user.id


def test_create_note_empty_text(client, db, test_user, auth_token):
    """POST /notes пустой text без тегов → 422."""
    response = client.post(
        "/notes/",
        json={"text": "", "tags": []},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 422


def test_create_note_tags_only(client, db, test_user, auth_token):
    """POST /notes: только теги, без текста — ок (live tagging)."""
    response = client.post(
        "/notes/",
        json={"text": "", "tags": ["лимп", "3bet"]},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["text"] == ""
    assert set(data["tags"]) == {"лимп", "3bet"}
    assert data["user_id"] == test_user.id


def test_create_note_invalid_note_type_422(client, test_user, auth_token):
    """POST /notes неверный note_type → 422 (enum-валидация)."""
    response = client.post(
        "/notes/",
        json={"text": "Текст", "tags": [], "note_type": "invalid_type"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 422


def test_get_notes_list(client, db, test_user, auth_token):
    """GET /notes → 200, список и total/limit/offset."""
    for i in range(3):
        note = NoteORM(
            user_id=test_user.id,
            text=f"Заметка {i}",
            tags=[f"тег{i}"],
        )
        db.add(note)
    db.commit()

    response = client.get("/notes/", headers={"Authorization": f"Bearer {auth_token}"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) == 3


def test_get_notes_filter_by_player(client, db, test_user, auth_token):
    """GET /notes?player_id=X → только заметки этого игрока."""
    player1 = PlayerORM(user_id=test_user.id, name="Player1")
    player2 = PlayerORM(user_id=test_user.id, name="Player2")
    db.add_all([player1, player2])
    db.commit()
    db.refresh(player1)
    db.refresh(player2)

    db.add_all([
        NoteORM(user_id=test_user.id, text="Note p1", player_id=player1.id, tags=[]),
        NoteORM(user_id=test_user.id, text="Note p1 again", player_id=player1.id, tags=[]),
        NoteORM(user_id=test_user.id, text="Note p2", player_id=player2.id, tags=[]),
    ])
    db.commit()

    response = client.get(
        f"/notes/?player_id={player1.id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert all(item["player_id"] == player1.id for item in data["items"])


def test_get_note_by_id(client, db, test_user, auth_token):
    """GET /notes/{id} → 200, данные совпадают."""
    note = NoteORM(user_id=test_user.id, text="Одна заметка", tags=["a", "b"])
    db.add(note)
    db.commit()
    db.refresh(note)

    response = client.get(
        f"/notes/{note.id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == note.id
    assert data["text"] == "Одна заметка"


def test_get_note_other_user(client, db, test_user, auth_token):
    """GET /notes/{id} чужой заметки → 404."""
    other = UserORM(
        email="other@example.com",
        hashed_password=TEST_PASSWORD_HASH,
        is_active=True,
    )
    db.add(other)
    db.commit()
    db.refresh(other)
    note = NoteORM(user_id=other.id, text="Чужая")
    db.add(note)
    db.commit()
    db.refresh(note)

    response = client.get(
        f"/notes/{note.id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 404


def test_update_note(client, db, test_user, auth_token):
    """PUT /notes/{id} → 200, данные обновились."""
    note = NoteORM(user_id=test_user.id, text="Старый текст", tags=["старый"])
    db.add(note)
    db.commit()
    db.refresh(note)

    response = client.put(
        f"/notes/{note.id}",
        json={"text": "Новый текст", "tags": ["новый"]},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Новый текст"
    assert data["tags"] == ["новый"]


def test_delete_note_soft(client, db, test_user, auth_token):
    """DELETE /notes/{id} → 200, body {"ok": true}; повторный GET → 404."""
    note = NoteORM(user_id=test_user.id, text="На удаление", tags=[])
    db.add(note)
    db.commit()
    db.refresh(note)

    response = client.delete(
        f"/notes/{note.id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    response2 = client.get(
        f"/notes/{note.id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response2.status_code == 404
