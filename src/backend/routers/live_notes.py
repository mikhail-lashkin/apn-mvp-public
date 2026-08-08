"""
@file: live_notes.py
@description: API роутер для работы с импортированными данными из Live Poker Notes
@dependencies: fastapi, sqlalchemy
@created: 2025-01-27
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from src.backend.db.session import get_db
from src.backend.services.live_notes_importer import LiveNotesImporter
from src.backend.models.template import Template
from src.backend.models.player_profile import PlayerProfile
from src.backend.models.board_analysis import BoardAnalysis

router = APIRouter(prefix="/live-notes", tags=["live-notes"])


@router.post("/import")
async def import_live_notes_data(db: Session = Depends(get_db)):
    """Импорт данных из Live Poker Notes"""
    try:
        importer = LiveNotesImporter(db)
        results = importer.import_all_data()
        return {
            "message": "Импорт завершен успешно",
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка импорта: {str(e)}")


@router.get("/templates", response_model=List[dict])
async def get_templates(
    template_type: Optional[str] = Query(None, description="Тип шаблона"),
    db: Session = Depends(get_db)
):
    """Получение шаблонов"""
    importer = LiveNotesImporter(db)
    
    if template_type:
        templates = importer.get_templates_by_type(template_type)
    else:
        templates = db.query(Template).all()
    
    return [
        {
            "id": t.id,
            "name": t.name,
            "type": t.type,
            "fields": t.fields,
            "sections": t.sections,
            "created_at": t.created_at
        }
        for t in templates
    ]


@router.get("/templates/{template_id}")
async def get_template(template_id: int, db: Session = Depends(get_db)):
    """Получение конкретного шаблона"""
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    return {
        "id": template.id,
        "name": template.name,
        "type": template.type,
        "fields": template.fields,
        "sections": template.sections,
        "template_content": template.template_content,
        "created_at": template.created_at
    }


@router.get("/player-profiles", response_model=List[dict])
async def get_player_profiles(
    style: Optional[str] = Query(None, description="Стиль игрока"),
    search: Optional[str] = Query(None, description="Поисковый запрос"),
    db: Session = Depends(get_db)
):
    """Получение профилей игроков"""
    importer = LiveNotesImporter(db)
    
    if search:
        profiles = importer.search_player_profiles(search)
    elif style:
        profiles = importer.get_player_profiles_by_style(style)
    else:
        profiles = db.query(PlayerProfile).all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "style": p.style,
            "patterns": p.patterns,
            "leaks": p.leaks,
            "exploits": p.exploits,
            "traps": p.traps,
            "regions": p.regions,
            "tags": p.tags,
            "created_at": p.created_at
        }
        for p in profiles
    ]


@router.get("/player-profiles/{profile_id}")
async def get_player_profile(profile_id: int, db: Session = Depends(get_db)):
    """Получение конкретного профиля игрока"""
    profile = db.query(PlayerProfile).filter(PlayerProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профиль игрока не найден")
    
    return {
        "id": profile.id,
        "name": profile.name,
        "style": profile.style,
        "patterns": profile.patterns,
        "leaks": profile.leaks,
        "exploits": profile.exploits,
        "traps": profile.traps,
        "regions": profile.regions,
        "tags": profile.tags,
        "content": profile.content,
        "created_at": profile.created_at
    }


@router.get("/board-analyses", response_model=List[dict])
async def get_board_analyses(
    spot: Optional[str] = Query(None, description="Спот"),
    board_texture: Optional[str] = Query(None, description="Текстура борда"),
    db: Session = Depends(get_db)
):
    """Получение анализов раздач"""
    importer = LiveNotesImporter(db)
    
    if spot:
        analyses = importer.get_board_analyses_by_spot(spot)
    else:
        query = db.query(BoardAnalysis)
        if board_texture:
            query = query.filter(BoardAnalysis.board_texture == board_texture)
        analyses = query.all()
    
    return [
        {
            "id": a.id,
            "date": a.date,
            "spot": a.spot,
            "board_texture": a.board_texture,
            "flop": a.flop,
            "gto_baseline": a.gto_baseline,
            "simplified_strategy": a.simplified_strategy,
            "exploit_adaptation": a.exploit_adaptation,
            "live_notes": a.live_notes,
            "created_at": a.created_at
        }
        for a in analyses
    ]


@router.get("/board-analyses/{analysis_id}")
async def get_board_analysis(analysis_id: int, db: Session = Depends(get_db)):
    """Получение конкретного анализа раздачи"""
    analysis = db.query(BoardAnalysis).filter(BoardAnalysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Анализ раздачи не найден")
    
    return {
        "id": analysis.id,
        "date": analysis.date,
        "spot": analysis.spot,
        "board_texture": analysis.board_texture,
        "flop": analysis.flop,
        "gto_baseline": analysis.gto_baseline,
        "simplified_strategy": analysis.simplified_strategy,
        "exploit_adaptation": analysis.exploit_adaptation,
        "live_notes": analysis.live_notes,
        "content": analysis.content,
        "created_at": analysis.created_at
    }


@router.get("/statistics")
async def get_statistics(db: Session = Depends(get_db)):
    """Получение статистики по импортированным данным"""
    importer = LiveNotesImporter(db)
    return importer.get_statistics()


@router.get("/search")
async def search_live_notes(
    query: str = Query(..., description="Поисковый запрос"),
    db: Session = Depends(get_db)
):
    """Поиск по всем данным Live Poker Notes"""
    importer = LiveNotesImporter(db)
    
    # Поиск в профилях игроков
    player_profiles = importer.search_player_profiles(query)
    
    # Поиск в шаблонах
    templates = db.query(Template).filter(
        Template.name.ilike(f"%{query}%") |
        Template.template_content.ilike(f"%{query}%")
    ).all()
    
    # Поиск в анализах раздач
    board_analyses = db.query(BoardAnalysis).filter(
        BoardAnalysis.spot.ilike(f"%{query}%") |
        BoardAnalysis.flop.ilike(f"%{query}%") |
        BoardAnalysis.content.ilike(f"%{query}%")
    ).all()
    
    return {
        "query": query,
        "results": {
            "player_profiles": [
                {"id": p.id, "name": p.name, "style": p.style}
                for p in player_profiles
            ],
            "templates": [
                {"id": t.id, "name": t.name, "type": t.type}
                for t in templates
            ],
            "board_analyses": [
                {"id": a.id, "spot": a.spot, "flop": a.flop}
                for a in board_analyses
            ]
        },
        "total_results": len(player_profiles) + len(templates) + len(board_analyses)
    } 