"""
Перечисляемые типы для заметок и игроков.
Используются в моделях (CheckConstraint) и в Pydantic-схемах (422 на опечатку).
"""

import enum


class NoteTypeEnum(str, enum.Enum):
    exploit = "exploit"
    read = "read"
    general = "general"
    timing = "timing"
    sizing = "sizing"


class StreetEnum(str, enum.Enum):
    preflop = "preflop"
    flop = "flop"
    turn = "turn"
    river = "river"


# Список строк для CheckConstraint в БД
NOTE_TYPE_VALUES = [e.value for e in NoteTypeEnum]
STREET_VALUES = [e.value for e in StreetEnum]
