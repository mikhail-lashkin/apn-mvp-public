"""
Pydantic-схемы для Notes API. Enum — защита от опечаток (422).
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.backend.models.enums import NoteTypeEnum, StreetEnum


class NoteCreate(BaseModel):
    """Создание заметки. Нужен текст и/или хотя бы один тег."""

    text: str = Field(
        default="",
        max_length=10_000,
        description="Текст заметки (0–10000; пустой ок, если есть теги)",
    )
    tags: Optional[List[str]] = Field(default_factory=list, max_length=20)
    player_id: Optional[int] = None
    table_id: Optional[int] = None
    session_id: Optional[int] = None
    note_type: NoteTypeEnum = Field(default=NoteTypeEnum.general)
    street: Optional[StreetEnum] = None

    @field_validator("text")
    @classmethod
    def text_stripped(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("tags")
    @classmethod
    def tags_dedup(cls, v: Optional[List[str]]) -> List[str]:
        if v is None:
            return []
        unique = list({t.strip() for t in v if t and t.strip()})
        if len(unique) > 20:
            raise ValueError("Максимум 20 тегов")
        return unique

    @model_validator(mode="after")
    def require_text_or_tags(self):
        # Live: часто ставят только чип (лимп/3bet) без простыни текста
        if not self.text and not self.tags:
            raise ValueError("Нужен текст заметки или хотя бы один тег")
        return self


class NoteUpdate(BaseModel):
    """Обновление заметки (все поля опциональны)."""

    text: Optional[str] = Field(None, min_length=1, max_length=10_000)
    tags: Optional[List[str]] = Field(None, max_length=20)
    player_id: Optional[int] = None
    table_id: Optional[int] = None
    session_id: Optional[int] = None
    note_type: Optional[NoteTypeEnum] = None
    street: Optional[StreetEnum] = None

    @field_validator("text")
    @classmethod
    def text_stripped(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        return v.strip()

    @field_validator("tags")
    @classmethod
    def tags_dedup(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        unique = list({t.strip() for t in v if t and t.strip()})
        if len(unique) > 20:
            raise ValueError("Максимум 20 тегов")
        return unique


class NoteRead(BaseModel):
    """Ответ API: одна заметка."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    text: str
    tags: List[str]
    player_id: Optional[int] = None
    table_id: Optional[int] = None
    session_id: Optional[int] = None
    note_type: str
    street: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
