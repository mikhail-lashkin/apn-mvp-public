"""
@file: prompts.py
@description: Версионированные промпты structured extraction (ML-1)
@created: 2026-08-08
"""

from typing import List, Sequence

PROMPT_VERSION = "v1"

SYSTEM_PROMPT_V1 = """Ты — помощник live-покерного игрока. По заметкам и меткам ColorSystem
верни ТОЛЬКО валидный JSON (без markdown) со схемой:
{
  "player_type": "<slug ColorSystem>",
  "confidence": 0.0-1.0,
  "patterns": ["краткий паттерн", ...],
  "suggested_tags": ["slug", ...],
  "caution_flags": ["low sample size", ...],
  "recommendation": "1-2 предложения: как играть против него сейчас"
}

Допустимые player_type / suggested_tags (ColorSystem):
whale, fish, passive_fish, aggro_fish, vip_aggressive, tight_reg, standard_reg, unknown_ss, unknown

Правила:
- Не выдумывай факты, которых нет в заметках.
- Пиши recommendation на русском, коротко, actionable.
- Если данных мало — понизь confidence и добавь caution_flags.
- Не используй имена людей — только стиль игры.
"""


def build_user_prompt(
    tag_code: str,
    notes: Sequence[dict],
    *,
    max_notes: int = 8,
    max_chars_per_note: int = 280,
) -> str:
    """notes: [{id, text, tags}] — без ФИО."""
    lines: List[str] = [f"player_tag: {tag_code}", "notes:"]
    for row in list(notes)[:max_notes]:
        nid = row.get("id", "?")
        text = (row.get("text") or "").strip().replace("\n", " ")
        if len(text) > max_chars_per_note:
            text = text[: max_chars_per_note - 1] + "…"
        tags = row.get("tags") or []
        tag_s = ",".join(str(t) for t in tags[:10]) if tags else "-"
        lines.append(f"- id={nid} tags=[{tag_s}] text={text or '(tags only)'}")
    if len(notes) == 0:
        lines.append("- (нет заметок — cold start по метке)")
    return "\n".join(lines)
