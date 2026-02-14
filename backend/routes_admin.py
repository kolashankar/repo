from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from typing import List
import logging
from models import Category, CategoryCreate, CategoryUpdate, Photo, PhotoCreate, UploadResponse, GlobalSettings, GlobalSettingsUpdate
from PIL import Image
import io
from auth import get_current_admin
from telegram_service import telegram_service
from file_handler import file_handler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ============ DATABASE DEPENDENCY ============

async def get_db(request: Request):
    """Get database from app state (initialized in server.py)"""
    db = request.app.state.get_db()
    if db is None:
        logger.error("❌ Database not available in routes_admin")
        raise HTTPException(
            status_code=503,
            detail="Database connection not available"
        )
    return db

# ============ GLOBAL SETTINGS ENDPOINTS ============

@router.get("/settings", response_model=GlobalSettings)
async def get_global_settings(
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Get global music settings"""
    try:
        settings = await db.global_settings.find_one({"id": "global_settings"}, {"_id": 0})
        if not settings:
            # Return default settings if none exist
            default_settings = GlobalSettings()
            return default_settings
        return settings
    except Exception as e:
        logger.error(f"Error fetching settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {str(e)}")

@router.put("/settings", response_model=GlobalSettings)
async def update_global_settings(
    settings: GlobalSettingsUpdate,
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Update global music settings"""
    try:
        update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Upsert - create if doesn't exist
        result = await db.global_settings.update_one(
            {"id": "global_settings"},
            {"$set": update_data},
            upsert=True
        )
        
        updated_doc = await db.global_settings.find_one({"id": "global_settings"}, {"_id": 0})
        if not updated_doc:
            # If still not found, return the update data
            return GlobalSettings(**update_data)
        return updated_doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

# ============ CATEGORY ENDPOINTS ============

@router.post("/categories", response_model=Category)
async def create_category(
    category: CategoryCreate,
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Create a new category"""
    try:
        category_obj = Category(
            **category.model_dump(),
            photos_before=[],
            photos_after=[]
        )
        doc = category_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        # Convert Photo objects to dicts
        doc['photos_before'] = [p.model_dump() if hasattr(p, 'model_dump') else p for p in doc['photos_before']]
        doc['photos_after'] = [p.model_dump() if hasattr(p, 'model_dump') else p for p in doc['photos_after']]
        
        await db.categories.insert_one(doc)
        return category_obj
    except Exception as e:
        logger.error(f"Error creating category: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create category: {str(e)}")

@router.get("/categories", response_model=List[Category])
async def get_categories(
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Get all categories"""
    try:
        categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
        return categories
    except Exception as e:
        logger.error(f"Error fetching categories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

@router.get("/categories/{category_id}", response_model=Category)
async def get_category(
    category_id: str,
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Get a specific category"""
    try:
        category = await db.categories.find_one({"id": category_id}, {"_id": 0})
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        return category
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching category: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch category: {str(e)}")

@router.put("/categories/{category_id}", response_model=Category)
async def update_category(
    category_id: str, 
    category: CategoryUpdate,
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Update category metadata (name, sentences)"""
    try:
        # Only update provided fields
        update_data = {k: v for k, v in category.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = await db.categories.update_one(
            {"id": category_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        
        updated_doc = await db.categories.find_one({"id": category_id}, {"_id": 0})
        return updated_doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating category: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update category: {str(e)}")

@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Delete a category"""
    try:
        result = await db.categories.delete_one({"id": category_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        return {"message": "Category deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting category: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete category: {str(e)}")

# ============ FILE UPLOAD ENDPOINTS ============

@router.post("/categories/{category_id}/upload-photo-before", response_model=UploadResponse)
async def upload_photo_before(
    category_id: str,
    file: UploadFile = File(...),
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """
    Upload a photo to show BEFORE accepting (with sentences/reject button)
    Uses Telegram for storage. Falls back to mock/base64 if not configured.
    """
    try:
        # Validate file
        validation_error = file_handler.validate_file(file)
        if validation_error:
            raise HTTPException(status_code=400, detail=validation_error)
        
        # Read file
        file_content = await file.read()

        # Ensure valid PNG via Pillow
        try:
            image = Image.open(io.BytesIO(file_content))
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            file_content = buffer.getvalue()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
        # Upload to Telegram or create base64 fallback
        file_url, telegram_file_id, file_size, mime_type = await telegram_service.upload_photo(
            file_content, 
            file.filename, 
            "image/png"
        )
        
        # Create Photo object
        photo = Photo(
            file_url=file_url,
            telegram_file_id=telegram_file_id,
            file_size=file_size,
            mime_type=mime_type
        )
        
        # Add to category's photos_before array
        result = await db.categories.update_one(
            {"id": category_id},
            {"$push": {"photos_before": photo.model_dump()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return UploadResponse(
            success=True,
            photo=photo,
            message="Photo uploaded successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/categories/{category_id}/upload-photo-after", response_model=UploadResponse)
async def upload_photo_after(
    category_id: str,
    file: UploadFile = File(...),
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """
    Upload a photo to show AFTER accepting (in 3D gallery)
    Uses Telegram for storage. Falls back to mock/base64 if not configured.
    """
    try:
        # Validate file
        validation_error = file_handler.validate_file(file)
        if validation_error:
            raise HTTPException(status_code=400, detail=validation_error)
        
        # Read file
        file_content = await file.read()

        # Ensure valid PNG via Pillow
        try:
            image = Image.open(io.BytesIO(file_content))
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            file_content = buffer.getvalue()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
        # Upload to Telegram or create base64 fallback
        file_url, telegram_file_id, file_size, mime_type = await telegram_service.upload_photo(
            file_content, 
            file.filename, 
            "image/png"
        )
        
        # Create Photo object
        photo = Photo(
            file_url=file_url,
            telegram_file_id=telegram_file_id,
            file_size=file_size,
            mime_type=mime_type
        )
        
        # Add to category's photos_after array
        result = await db.categories.update_one(
            {"id": category_id},
            {"$push": {"photos_after": photo.model_dump()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return UploadResponse(
            success=True,
            photo=photo,
            message="Photo uploaded successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.delete("/categories/{category_id}/photos/{photo_id}")
async def delete_photo(
    category_id: str,
    photo_id: str,
    photo_type: str,  # "before" or "after"
    admin: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Delete a photo from a category"""
    try:
        if photo_type not in ["before", "after"]:
            raise HTTPException(status_code=400, detail="photo_type must be 'before' or 'after'")
        
        field = f"photos_{photo_type}"
        
        result = await db.categories.update_one(
            {"id": category_id},
            {"$pull": {field: {"id": photo_id}}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return {"message": "Photo deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting photo: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete photo: {str(e)}")
