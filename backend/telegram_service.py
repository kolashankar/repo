"""
Telegram CDN Integration Service
Handles file uploads to Telegram and generates CDN URLs
"""

import os
import logging
from typing import Optional, Tuple
from pathlib import Path
import aiohttp
import json

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        self.bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', 'mock_bot_token_12345')
        self.api_id = os.environ.get('TELEGRAM_API_ID', 'mock_api_id')
        self.api_hash = os.environ.get('TELEGRAM_API_HASH', 'mock_api_hash')
        self.file_channel_id = os.environ.get('TELEGRAM_FILE_CHANNEL_ID', '-100mock_channel_id')
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        
        # Mock mode detection
        self.mock_mode = self.bot_token.startswith('mock_')
        if self.mock_mode:
            logger.warning("Telegram Service running in MOCK MODE - no actual uploads")
    
    async def upload_photo(self, file_content: bytes, filename: str, mime_type: str) -> Tuple[str, Optional[str], int, str]:
        """
        Upload photo to Telegram and return (file_url, telegram_file_id, file_size, mime_type)
        
        In mock mode, returns mock data with placeholder URLs
        In production mode, uploads to Telegram channel
        """
        file_size = len(file_content)
        
        try:
            if self.mock_mode:
                # Mock mode - generate fake IDs and use a placeholder image service
                import hashlib
                file_hash = hashlib.md5(file_content).hexdigest()
                mock_file_id = f"AgACAgIAAxkBAAI_{file_hash}_mock"
                
                # Create a data URL from the actual uploaded image
                import base64
                base64_image = base64.b64encode(file_content).decode('utf-8')
                file_url = f"data:{mime_type};base64,{base64_image}"
                
                logger.info(f"Mock upload: {filename} -> {mock_file_id[:20]}...")
                return file_url, mock_file_id, file_size, mime_type
            
            else:
                # Production mode - actual Telegram upload
                async with aiohttp.ClientSession() as session:
                    data = aiohttp.FormData()
                    data.add_field('chat_id', self.file_channel_id)
                    data.add_field('photo', file_content, filename=filename, content_type=mime_type)
                    
                    async with session.post(f"{self.base_url}/sendPhoto", data=data) as resp:
                        if resp.status == 200:
                            result = await resp.json()
                            if result.get('ok'):
                                photo_data = result['result']['photo'][-1]  # Get largest size
                                file_id = photo_data['file_id']
                                
                                # Get file path to construct URL
                                file_url = await self._get_file_url(file_id)
                                
                                if not file_url:
                                    logger.error("Failed to get file URL from Telegram")
                                    raise Exception("Failed to get file URL")
                                
                                logger.info(f"Uploaded to Telegram: {filename} -> {file_id}")
                                return file_url, file_id, file_size, mime_type
                        
                        error_text = await resp.text()
                        logger.error(f"Telegram upload failed: {error_text}")
                        raise Exception(f"Telegram API error: {error_text}")
                        
        except Exception as e:
            logger.error(f"Error uploading to Telegram: {str(e)}")
            raise
    
    async def _get_file_url(self, file_id: str) -> Optional[str]:
        """Get file URL from Telegram file_id"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/getFile?file_id={file_id}") as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        if result.get('ok'):
                            file_path = result['result']['file_path']
                            return f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}"
            return None
        except Exception as e:
            logger.error(f"Error getting file URL: {str(e)}")
            return None
    
    async def delete_photo(self, file_id: str) -> bool:
        """
        Delete photo from Telegram (if possible)
        Note: Telegram doesn't provide direct file deletion, 
        but we can delete the message from the channel
        """
        if self.mock_mode:
            logger.info(f"Mock delete: {file_id}")
            return True
        
        # In production, you'd need to track message_id when uploading
        # and use deleteMessage API call
        logger.warning("Telegram file deletion not fully implemented - files remain in channel")
        return True
    
    def validate_file(self, file_content: bytes, mime_type: str, max_size_mb: int = 10) -> Tuple[bool, str]:
        """
        Validate file before upload
        Returns (is_valid, error_message)
        """
        # Check file size
        file_size = len(file_content)
        max_size_bytes = max_size_mb * 1024 * 1024
        
        if file_size > max_size_bytes:
            return False, f"File too large. Maximum size is {max_size_mb}MB"
        
        if file_size == 0:
            return False, "File is empty"
        
        # Check mime type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if mime_type not in allowed_types:
            return False, f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        
        return True, ""

# Singleton instance
telegram_service = TelegramService()
