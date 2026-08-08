"""Заглушка парсера Live Poker Notes для dev/docker (MVP auth не использует импорт)."""


class LivePokerNotesParser:
    def parse_templates(self):
        return []

    def parse_player_profiles(self):
        return []

    def parse_board_analyses(self):
        return []

    def export_to_json(self, json_file_path: str):
        return {"templates": [], "player_profiles": [], "board_analyses": []}
