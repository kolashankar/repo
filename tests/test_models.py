"""Unit tests for database models"""
import pytest
from pydantic import ValidationError
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.models import Category, Photo
from datetime import datetime
import uuid


class TestPhotoModel:
    """Test Photo model validation and structure"""
    
    def test_photo_creation_valid(self):
        """Test creating a valid Photo object"""
        photo_data = {
            "id": str(uuid.uuid4()),
            "telegram_file_id": "test_file_123",
            "telegram_file_unique_id": "unique_123",
            "file_url": "https://example.com/photo.jpg",
            "file_size": 1024,
            "mime_type": "image/jpeg",
            "uploaded_at": datetime.now()
        }
        
        photo = Photo(**photo_data)
        assert photo.id == photo_data["id"]
        assert photo.telegram_file_id == photo_data["telegram_file_id"]
        assert photo.file_size == 1024


class TestCategoryModel:
    """Test Category model validation and structure"""
    
    def test_category_creation_valid(self):
        """Test creating a valid Category object"""
        category_data = {
            "id": str(uuid.uuid4()),
            "name": "Test Category",
            "photos_before": [],
            "photos_after": [],
            "sentences": ["Test sentence 1", "Test sentence 2"],
            "music_before": "https://example.com/music1.mp3",
            "music_after": "https://example.com/music2.mp3",
            "created_at": datetime.now()
        }
        
        category = Category(**category_data)
        assert category.name == "Test Category"
        assert len(category.sentences) == 2
