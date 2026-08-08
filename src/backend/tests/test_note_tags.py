"""
@file: test_note_tags.py
@description: SC-7 — slug + CRUD strip from notes.tags
@created: 2026-07-18
"""

import src.backend.models.note_tag  # noqa: F401
from src.backend.models.note import NoteORM
from src.backend.models.user import UserORM
from src.backend.services import note_tag_service as nts


def test_slugify_code():
    assert nts._slugify_code("My Tag") == "my_tag"
    assert nts._slugify_code("лимп") == "custom"
    assert nts._slugify_code("!!!") == "custom"


def test_create_and_delete_strips_notes(db):
    user = UserORM(email="notetags@test.local", hashed_password="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    row = nts.create_note_tag(db, label="Bluff Tell", group_id="bluff_timing")
    assert row.code == "bluff_tell"
    assert row.group_id == "bluff_timing"
    assert row.is_system is False

    note = NoteORM(
        user_id=user.id,
        text="test",
        tags=["лимп", row.code, "недоблеф"],
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    nts.delete_note_tag(db, row.id)
    db.refresh(note)
    assert row.code not in (note.tags or [])
    assert "лимп" in note.tags
    assert nts.get_by_code(db, "bluff_tell") is None


def test_reorder(db):
    a = nts.create_note_tag(db, label="A Tag", group_id="preflop")
    b = nts.create_note_tag(db, label="B Tag", group_id="preflop")
    rows = nts.reorder_note_tags(
        db, [{"id": a.id, "sort_order": 100}, {"id": b.id, "sort_order": 50}]
    )
    by_id = {r.id: r.sort_order for r in rows}
    assert by_id[b.id] == 50
    assert by_id[a.id] == 100
