"""
File Upload Handler Utilities
"""

import logging
from fastapi import UploadFile, HTTPException
from typing import Tuple, Optional
# import magic  # python-magic for mime type detection - using filetype instead

logger = logging.getLogger(__name__)

class FileHandler:
    
    ALLOWED_EXTENSIONS = {'.png'}
    ALLOWED_MIME_TYPES = {
        'image/png'
    }
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    @staticmethod
    def validate_file(file: UploadFile) -> Optional[str]:
        """
        Quick validation of uploaded file
        Returns error message if invalid, None if valid
        """
        if not file or not file.filename:
            return "No file provided"
        
        # Check file extension
        file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
        if f".{file_ext}" not in FileHandler.ALLOWED_EXTENSIONS:
            return f"Invalid file extension. Allowed: {', '.join(FileHandler.ALLOWED_EXTENSIONS)}"
        
        # Check mime type
        if file.content_type and file.content_type not in FileHandler.ALLOWED_MIME_TYPES:
            return f"Invalid file type. Allowed: {', '.join(FileHandler.ALLOWED_MIME_TYPES)}"
        
        return None
    
    @staticmethod
    async def validate_and_read_upload(upload_file: UploadFile) -> Tuple[bytes, str, str]:
        """
        Validate and read uploaded file
        Returns (file_content, mime_type, filename)
        Raises HTTPException if validation fails
        """
        try:
            # Read file content
            file_content = await upload_file.read()
            filename = upload_file.filename or "unknown"
            
            # Check file size
            file_size = len(file_content)
            if file_size > FileHandler.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large. Maximum size is {FileHandler.MAX_FILE_SIZE // (1024*1024)}MB"
                )
            
            if file_size == 0:
                raise HTTPException(status_code=400, detail="File is empty")
            
            # Check file extension
            file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
            if f".{file_ext}" not in FileHandler.ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file extension. Allowed: {', '.join(FileHandler.ALLOWED_EXTENSIONS)}"
                )
            
            # Detect actual mime type from content (more secure than trusting client)
            mime_type = upload_file.content_type
            
            # Validate mime type
            if mime_type not in FileHandler.ALLOWED_MIME_TYPES:
                # Try to detect from content as fallback
                try:
                    import filetype
                    kind = filetype.guess(file_content)
                    if kind and kind.mime in FileHandler.ALLOWED_MIME_TYPES:
                        mime_type = kind.mime
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid file type. Allowed: {', '.join(FileHandler.ALLOWED_MIME_TYPES)}"
                        )
                except ImportError:
                    # filetype not installed, trust the provided mime_type
                    logger.warning("filetype library not installed, mime type validation limited")
            
            logger.info(f"File validated: {filename} ({file_size} bytes, {mime_type})")
            return file_content, mime_type, filename
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error validating file: {str(e)}")
            raise HTTPException(status_code=500, detail="Error processing file upload")
    
    @staticmethod
    def format_file_size(size_bytes: int) -> str:
        """Format bytes to human readable size"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"

file_handler = FileHandler()
