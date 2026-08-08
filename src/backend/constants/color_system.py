"""
@file: color_system.py
@description: Seed меток ColorSystem = Colors_to_PlayerTypes (начальный набор)
@created: 2026-07-15
@updated: 2026-07-21
"""

# Порядок = Obsidian Colors_to_PlayerTypes (VIP → любители → регы → SS unknown)
COLOR_SYSTEM_SEED = [
    # code, label, color, sort_order
    ("whale", "🐋 VIP 60+", "#A855F7", 1),
    ("fish", "🐟 Fish", "#EF4444", 2),
    ("passive_fish", "🫧 Passive fish", "#38BDF8", 3),
    ("aggro_fish", "🐡 Aggro fish", "#F97316", 4),
    ("vip_aggressive", "📱 VIP Aggressive", "#EC4899", 5),
    ("tight_reg", "📒 Tight Reg", "#15803D", 6),
    ("standard_reg", "🃏 Standard Reg", "#22C55E", 7),
    ("unknown_ss", "🟡 Unknown <100bb", "#EAB308", 8),
]

# Старые значения player_tag / mobile enum → slug справочника
LEGACY_TAG_MAP = {
    "fish": "fish",
    "passive": "passive_fish",
    "passive_fish": "passive_fish",
    "whale": "whale",
    "vip": "whale",
    "aggro": "aggro_fish",
    "aggro_fish": "aggro_fish",
    "maniac": "aggro_fish",
    "nit": "tight_reg",
    "tag": "tight_reg",
    "tight_reg": "tight_reg",
    "reg": "standard_reg",
    "regular": "standard_reg",
    "standard_reg": "standard_reg",
    "lag": "standard_reg",
    "aggro_reg": "standard_reg",
    "vip_a": "vip_aggressive",
    "vip_aggressive": "vip_aggressive",
    "unknown_ss": "unknown_ss",
    "overbet": "fish",
    "underdef_bb": "fish",
    "timing": "standard_reg",
    "unknown": "unknown",
}

SEED_CODES = {row[0] for row in COLOR_SYSTEM_SEED}
KNOWN_CODES = SEED_CODES | {"unknown", "empty"}


def normalize_player_tag_code(raw: str | None) -> str:
    """Приводит любой старый/новый код к slug справочника."""
    if not raw or not str(raw).strip():
        return "unknown"
    key = str(raw).strip().lower().replace("-", "_").replace(" ", "_")
    mapped = LEGACY_TAG_MAP.get(key)
    if mapped:
        return mapped
    if key in KNOWN_CODES:
        return key
    # неизвестное custom — не роняем; catch-all только для совсем пустых уже выше
    # TODO: когда появится словарь custom на бэке — валидировать по БД
    return key if key else "unknown"
