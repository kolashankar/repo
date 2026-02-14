from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

# Photo Model with Telegram metadata
class Photo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_file_id: Optional[str] = None
    telegram_file_unique_id: Optional[str] = None
    file_url: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PhotoCreate(BaseModel):
    file_url: str
    telegram_file_id: Optional[str] = None
    telegram_file_unique_id: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None

# Category Models (NO MUSIC FIELDS - music is now global)
class CategoryBase(BaseModel):
    name: str
    photos_before: List[Photo] = []  # Photos shown before accepting
    photos_after: List[Photo] = []   # Photos shown in 3D gallery after accepting
    sentences: List[str] = []

class CategoryCreate(BaseModel):
    name: str
    sentences: List[str] = []

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    sentences: Optional[List[str]] = None

class Category(CategoryBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Global Settings Model
class GlobalSettings(BaseModel):
    id: str = "global_settings"  # Fixed ID for singleton
    before_accept_music: Optional[str] = None  # YouTube URL
    after_accept_music: Optional[str] = None   # YouTube URL

class GlobalSettingsUpdate(BaseModel):
    before_accept_music: Optional[str] = None
    after_accept_music: Optional[str] = None

# Auth Models
class AdminLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# File Upload Response
class UploadResponse(BaseModel):
    success: bool
    photo: Optional[Photo] = None
    message: str
