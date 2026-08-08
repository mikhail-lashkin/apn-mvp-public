"""
@file: live_notes_importer.py
@description: Сервис для импорта данных из Live Poker Notes в базу данных
@dependencies: sqlalchemy, json, pathlib
@created: 2025-01-27
"""

import json
from pathlib import Path
from typing import Dict, List, Any
from sqlalchemy.orm import Session
from src.backend.models.template import Template
from src.backend.models.player_profile import PlayerProfile
from src.backend.models.board_analysis import BoardAnalysis
from src.utils.livePokerNotesParser import LivePokerNotesParser


class LiveNotesImporter:
    """Сервис для импорта данных из Live Poker Notes"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.parser = LivePokerNotesParser()
        
    def import_all_data(self, json_file_path: str = "parsed_data.json") -> Dict[str, int]:
        """Импорт всех данных из JSON файла"""
        if not Path(json_file_path).exists():
            # Если файл не существует, запускаем парсинг
            self.parser.parse_templates()
            self.parser.parse_player_profiles()
            self.parser.parse_board_analyses()
            data = self.parser.export_to_json(json_file_path)
        else:
            # Загружаем существующий JSON
            with open(json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        
        results = {
            "templates_imported": 0,
            "player_profiles_imported": 0,
            "board_analyses_imported": 0,
            "errors": []
        }
        
        # Импорт шаблонов
        if "templates" in data:
            results["templates_imported"] = self._import_templates(data["templates"])
        
        # Импорт профилей игроков
        if "player_profiles" in data:
            results["player_profiles_imported"] = self._import_player_profiles(data["player_profiles"])
        
        # Импорт анализов раздач
        if "board_analyses" in data:
            results["board_analyses_imported"] = self._import_board_analyses(data["board_analyses"])
        
        return results
    
    def _import_templates(self, templates_data: List[Dict[str, Any]]) -> int:
        """Импорт шаблонов в базу данных"""
        imported_count = 0
        
        for template_data in templates_data:
            try:
                # Проверяем, существует ли уже такой шаблон
                existing = self.db.query(Template).filter(
                    Template.name == template_data["name"]
                ).first()
                
                if existing:
                    # Обновляем существующий
                    existing.type = template_data["type"]
                    existing.fields = template_data["fields"]
                    existing.sections = template_data["sections"]
                    existing.template_content = template_data["template_content"]
                else:
                    # Создаем новый
                    template = Template(
                        name=template_data["name"],
                        type=template_data["type"],
                        fields=template_data["fields"],
                        sections=template_data["sections"],
                        template_content=template_data["template_content"]
                    )
                    self.db.add(template)
                
                imported_count += 1
                
            except Exception as e:
                print(f"Ошибка импорта шаблона {template_data.get('name', 'Unknown')}: {e}")
        
        self.db.commit()
        return imported_count
    
    def _import_player_profiles(self, profiles_data: List[Dict[str, Any]]) -> int:
        """Импорт профилей игроков в базу данных"""
        imported_count = 0
        
        for profile_data in profiles_data:
            try:
                # Проверяем, существует ли уже такой профиль
                existing = self.db.query(PlayerProfile).filter(
                    PlayerProfile.name == profile_data["name"]
                ).first()
                
                if existing:
                    # Обновляем существующий
                    existing.style = profile_data["style"]
                    existing.patterns = profile_data["patterns"]
                    existing.leaks = profile_data["leaks"]
                    existing.exploits = profile_data["exploits"]
                    existing.traps = profile_data["traps"]
                    existing.regions = profile_data["regions"]
                    existing.tags = profile_data["tags"]
                    existing.content = profile_data["content"]
                else:
                    # Создаем новый
                    profile = PlayerProfile(
                        name=profile_data["name"],
                        style=profile_data["style"],
                        patterns=profile_data["patterns"],
                        leaks=profile_data["leaks"],
                        exploits=profile_data["exploits"],
                        traps=profile_data["traps"],
                        regions=profile_data["regions"],
                        tags=profile_data["tags"],
                        content=profile_data["content"]
                    )
                    self.db.add(profile)
                
                imported_count += 1
                
            except Exception as e:
                print(f"Ошибка импорта профиля {profile_data.get('name', 'Unknown')}: {e}")
        
        self.db.commit()
        return imported_count
    
    def _import_board_analyses(self, analyses_data: List[Dict[str, Any]]) -> int:
        """Импорт анализов раздач в базу данных"""
        imported_count = 0
        
        for analysis_data in analyses_data:
            try:
                # Проверяем, существует ли уже такой анализ
                existing = self.db.query(BoardAnalysis).filter(
                    BoardAnalysis.spot == analysis_data["spot"],
                    BoardAnalysis.flop == analysis_data["flop"]
                ).first()
                
                if existing:
                    # Обновляем существующий
                    existing.date = analysis_data["date"]
                    existing.board_texture = analysis_data["board_texture"]
                    existing.gto_baseline = analysis_data["gto_baseline"]
                    existing.simplified_strategy = analysis_data["simplified_strategy"]
                    existing.exploit_adaptation = analysis_data["exploit_adaptation"]
                    existing.live_notes = analysis_data["live_notes"]
                    existing.content = analysis_data["content"]
                else:
                    # Создаем новый
                    analysis = BoardAnalysis(
                        date=analysis_data["date"],
                        spot=analysis_data["spot"],
                        board_texture=analysis_data["board_texture"],
                        flop=analysis_data["flop"],
                        gto_baseline=analysis_data["gto_baseline"],
                        simplified_strategy=analysis_data["simplified_strategy"],
                        exploit_adaptation=analysis_data["exploit_adaptation"],
                        live_notes=analysis_data["live_notes"],
                        content=analysis_data["content"]
                    )
                    self.db.add(analysis)
                
                imported_count += 1
                
            except Exception as e:
                print(f"Ошибка импорта анализа {analysis_data.get('spot', 'Unknown')}: {e}")
        
        self.db.commit()
        return imported_count
    
    def get_templates_by_type(self, template_type: str) -> List[Template]:
        """Получение шаблонов по типу"""
        return self.db.query(Template).filter(Template.type == template_type).all()
    
    def get_player_profiles_by_style(self, style: str) -> List[PlayerProfile]:
        """Получение профилей игроков по стилю"""
        return self.db.query(PlayerProfile).filter(PlayerProfile.style == style).all()
    
    def get_board_analyses_by_spot(self, spot: str) -> List[BoardAnalysis]:
        """Получение анализов раздач по споту"""
        return self.db.query(BoardAnalysis).filter(BoardAnalysis.spot == spot).all()
    
    def search_player_profiles(self, query: str) -> List[PlayerProfile]:
        """Поиск профилей игроков по запросу"""
        return self.db.query(PlayerProfile).filter(
            PlayerProfile.name.ilike(f"%{query}%") |
            PlayerProfile.style.ilike(f"%{query}%") |
            PlayerProfile.content.ilike(f"%{query}%")
        ).all()
    
    def get_statistics(self) -> Dict[str, Any]:
        """Получение статистики по импортированным данным"""
        return {
            "templates_count": self.db.query(Template).count(),
            "player_profiles_count": self.db.query(PlayerProfile).count(),
            "board_analyses_count": self.db.query(BoardAnalysis).count(),
            "template_types": [t.type for t in self.db.query(Template.type).distinct().all()],
            "player_styles": [p.style for p in self.db.query(PlayerProfile.style).distinct().all() if p.style],
            "spots_analyzed": [b.spot for b in self.db.query(BoardAnalysis.spot).distinct().all() if b.spot]
        }


def main():
    """Основная функция для тестирования импорта"""
    from src.backend.db.session import get_db
    
    db = next(get_db())
    importer = LiveNotesImporter(db)
    
    print("Начинаю импорт данных из Live Poker Notes...")
    
    results = importer.import_all_data()
    
    print(f"Импорт завершен:")
    print(f"  Шаблонов импортировано: {results['templates_imported']}")
    print(f"  Профилей игроков импортировано: {results['player_profiles_imported']}")
    print(f"  Анализов раздач импортировано: {results['board_analyses_imported']}")
    
    # Вывод статистики
    stats = importer.get_statistics()
    print("\nСтатистика базы данных:")
    for key, value in stats.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main() 