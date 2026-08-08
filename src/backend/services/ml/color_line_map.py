"""
@file: color_line_map.py
@description: Статическая карта ColorSystem → дефолтная линия (cold-start / fallback)
@dependencies: color_system, player_profile_ml
@created: 2026-08-08
"""

from typing import List, Optional

from src.backend.constants.color_system import normalize_player_tag_code
from src.backend.schemas.player_profile_ml import PROMPT_VERSION, PlayerProfileMl

# Короткие линии под live-стол — не эссе
COLOR_LINE_MAP = {
    "whale": {
        "line": "Играй value толстыми руками, не блефуй тонко. Дай им поставить.",
        "patterns": ["глубокий стек", "платит value"],
    },
    "fish": {
        "line": "Изолируй, value-бет толще обычного. Избегай тонких блефов.",
        "patterns": ["широкий диапазон", "ошибки постфлоп"],
    },
    "passive_fish": {
        "line": "Бет/контбет за value. Не блефуй — они редко фолдят.",
        "patterns": ["пассивный колл", "редко рейзит"],
    },
    "aggro_fish": {
        "line": "Трапь крепкие руки, колл-даун шире. Не лайт-3бет без эквити.",
        "patterns": ["овербет", "агрессия без диапазона"],
    },
    "vip_aggressive": {
        "line": "Не форсируй блефы. Дожидайся сильных рук и дай им повеситься.",
        "patterns": ["мобильный VIP", "высокий VPIP"],
    },
    "tight_reg": {
        "line": "Стил/3бет с позицией. Не пэй-офф лайт против их рейзов.",
        "patterns": ["тайтовый диапазон", "солидный рег"],
    },
    "standard_reg": {
        "line": "Стандартные размеры, ищи leaks в их 3бет/C-bet частотах.",
        "patterns": ["balanced-ish", "знакомые линии"],
    },
    "unknown_ss": {
        "line": "Осторожно со стеком <100bb: пуш/фолд споты, не раздувай банк вслепую.",
        "patterns": ["короткий стек", "мало данных"],
    },
    "unknown": {
        "line": "Собери 1–2 заметки и метку ColorSystem — пока играй стандартно.",
        "patterns": [],
    },
}


def rule_based_profile(
    player_tag: Optional[str],
    *,
    note_ids: Optional[List[str]] = None,
    note_count: int = 0,
    extra_flags: Optional[List[str]] = None,
) -> PlayerProfileMl:
    """Cold-start и fallback без LLM."""
    code = normalize_player_tag_code(player_tag)
    row = COLOR_LINE_MAP.get(code) or COLOR_LINE_MAP["unknown"]

    flags: List[str] = []
    if note_count <= 0:
        flags.append("no notes")
        flags.append("tag only" if code not in ("unknown", "empty") else "cold start")
    elif note_count < 3:
        flags.append("low sample size")

    if extra_flags:
        for f in extra_flags:
            if f and f not in flags:
                flags.append(f)

    conf = 0.35 if note_count <= 0 else 0.45
    if code in ("unknown", "empty"):
        conf = 0.2

    suggested = [] if code in ("unknown", "empty") else [code]

    return PlayerProfileMl(
        player_type=code if code != "empty" else "unknown",
        confidence=conf,
        patterns=list(row["patterns"]),
        suggested_tags=suggested,
        supporting_notes=list(note_ids or [])[:8],
        caution_flags=flags,
        recommendation=row["line"],
        source="rule",
        provider="none",
        prompt_version=PROMPT_VERSION,
    )
