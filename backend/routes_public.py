from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List, Optional, Dict, Any
import logging
from models import Category, GlobalSettings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public", tags=["public"])

# ============ DATABASE DEPENDENCY ============

async def get_db(request: Request):
    """Get database from app state (initialized in server.py)"""
    db = request.app.state.get_db()
    if db is None:
        logger.error("❌ Database not available in routes_public")
        raise HTTPException(
            status_code=503,
            detail="Database connection not available"
        )
    return db

@router.get("/random-proposal")
async def get_random_proposal(db = Depends(get_db)) -> Dict[str, Any]:
    """Get random proposal with global music settings"""
    try:
        # Get all categories
        categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
        
        if not categories:
            raise HTTPException(status_code=404, detail="No categories found")
        
        # Get global settings
        settings = await db.global_settings.find_one({"id": "global_settings"}, {"_id": 0})
        if not settings:
            settings = {
                "before_accept_music": None,
                "after_accept_music": None
            }
        
        # Return all categories with global music
        return {
            "categories": categories,
            "music_before": settings.get("before_accept_music"),
            "music_after": settings.get("after_accept_music")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching proposal: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch proposal: {str(e)}")

@router.get("/settings", response_model=GlobalSettings)
async def get_public_settings(db = Depends(get_db)):
    """Get global settings (public endpoint for music URLs)"""
    try:
        settings = await db.global_settings.find_one({"id": "global_settings"}, {"_id": 0})
        if not settings:
            return GlobalSettings()
        return settings
    except Exception as e:
        logger.error(f"Error fetching public settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {str(e)}")
