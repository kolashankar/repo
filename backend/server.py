"""
Production-Ready FastAPI Server for Render Deployment
Handles CORS, MongoDB, Exception Handling, and Logging
"""

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
import logging
import traceback
from pathlib import Path
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from typing import Optional

# ============================================================
# LOGGING CONFIGURATION
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================
ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'

# Load .env file if exists (for local dev)
if env_path.exists():
    logger.info(f"Loading .env from {env_path}")
    load_dotenv(env_path)
else:
    logger.info("No .env file found, using system environment variables (Render)")

# Validate critical environment variables
REQUIRED_ENV_VARS = ['MONGO_URL', 'DB_NAME', 'JWT_SECRET']
missing_vars = [var for var in REQUIRED_ENV_VARS if not os.environ.get(var)]

if missing_vars:
    logger.error(f"❌ Missing required environment variables: {missing_vars}")
    logger.error("Cannot start server without required configuration")
    sys.exit(1)

# Get environment variables
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')

# Parse CORS origins
if CORS_ORIGINS == '*':
    cors_origins_list = ['*']
else:
    cors_origins_list = [origin.strip() for origin in CORS_ORIGINS.split(',')]

logger.info("=" * 60)
logger.info("🚀 SERVER CONFIGURATION")
logger.info("=" * 60)
logger.info(f"📊 Database: {DB_NAME}")
logger.info(f"🔐 MongoDB URL: {MONGO_URL[:30]}...") # Only show start for security
logger.info(f"🌍 CORS Origins: {cors_origins_list}")
logger.info(f"🔑 JWT Secret: {'✓ Loaded' if JWT_SECRET else '✗ Missing'}")
logger.info("=" * 60)

# ============================================================
# GLOBAL DATABASE CLIENT
# ============================================================
mongo_client: Optional[AsyncIOMotorClient] = None
database = None

# ============================================================
# LIFESPAN CONTEXT MANAGER (Startup/Shutdown)
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    Replaces deprecated @app.on_event decorators
    """
    global mongo_client, database
    
    # STARTUP
    logger.info("=" * 60)
    logger.info("🟢 STARTING APPLICATION")
    logger.info("=" * 60)
    
    try:
        # Initialize MongoDB connection
        logger.info("📡 Connecting to MongoDB...")
        mongo_client = AsyncIOMotorClient(
            MONGO_URL,
            serverSelectionTimeoutMS=5000,  # 5 second timeout
            connectTimeoutMS=10000,
            socketTimeoutMS=10000,
        )
        
        # Test connection
        await mongo_client.admin.command('ping')
        database = mongo_client[DB_NAME]
        
        logger.info("✅ MongoDB connection successful")
        logger.info(f"✅ Database '{DB_NAME}' ready")
        
        # Test collections access
        collections = await database.list_collection_names()
        logger.info(f"📚 Available collections: {collections}")
        
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {str(e)}")
        logger.error(f"❌ Full error: {traceback.format_exc()}")
        logger.error("❌ Server will continue but database operations will fail")
        mongo_client = None
        database = None
    
    logger.info("=" * 60)
    logger.info("✅ APPLICATION STARTUP COMPLETE")
    logger.info("=" * 60)
    
    yield  # Application runs here
    
    # SHUTDOWN
    logger.info("=" * 60)
    logger.info("🔴 SHUTTING DOWN APPLICATION")
    logger.info("=" * 60)
    
    if mongo_client:
        logger.info("🔌 Closing MongoDB connection...")
        mongo_client.close()
        logger.info("✅ MongoDB connection closed")
    
    logger.info("✅ SHUTDOWN COMPLETE")

# ============================================================
# FASTAPI APP INITIALIZATION
# ============================================================
app = FastAPI(
    title="Romantic Proposal API",
    description="Backend API for photo gallery proposal app",
    version="1.0.0",
    lifespan=lifespan
)

# ============================================================
# CORS MIDDLEWARE
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight for 1 hour
)

logger.info(f"✅ CORS middleware configured with origins: {cors_origins_list}")

# ============================================================
# DEPENDENCY: GET DATABASE
# ============================================================
async def get_database():
    """Dependency to get database instance"""
    if database is None:
        logger.error("❌ Database not initialized")
        raise HTTPException(
            status_code=503,
            detail="Database connection not available. Please check server logs."
        )
    return database

# ============================================================
# GLOBAL EXCEPTION HANDLERS
# ============================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler for any unhandled exceptions
    Ensures CORS headers are ALWAYS present
    """
    logger.error("=" * 60)
    logger.error("🚨 UNHANDLED EXCEPTION")
    logger.error("=" * 60)
    logger.error(f"Path: {request.method} {request.url.path}")
    logger.error(f"Exception Type: {type(exc).__name__}")
    logger.error(f"Exception Message: {str(exc)}")
    logger.error(f"Traceback:\n{traceback.format_exc()}")
    logger.error("=" * 60)
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc),
            "type": type(exc).__name__,
            "path": request.url.path
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle HTTP exceptions (401, 404, etc.) with CORS headers
    """
    logger.warning(f"⚠️  HTTP {exc.status_code}: {request.method} {request.url.path} - {exc.detail}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "path": request.url.path
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle request validation errors (422) with CORS headers
    """
    logger.warning(f"⚠️  Validation Error: {request.method} {request.url.path}")
    logger.warning(f"Errors: {exc.errors()}")
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Request validation failed",
            "errors": exc.errors(),
            "path": request.url.path
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

# ============================================================
# MIDDLEWARE: REQUEST LOGGING
# ============================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Log all incoming requests and their responses
    """
    logger.info(f"📥 {request.method} {request.url.path}")
    
    # Log request headers (excluding sensitive data)
    if request.headers.get("authorization"):
        logger.info("🔑 Authorization header present")
    
    try:
        response = await call_next(request)
        logger.info(f"📤 {request.method} {request.url.path} → {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"❌ Request processing failed: {str(e)}")
        raise

# ============================================================
# IMPORT MODELS AND AUTH (After DB setup)
# ============================================================
try:
    from models import AdminLogin, Token
    from auth import create_access_token, get_current_admin
    logger.info("✅ Models and auth modules loaded")
except Exception as e:
    logger.error(f"❌ Failed to import models/auth: {str(e)}")
    raise

# ============================================================
# IMPORT ROUTERS
# ============================================================
try:
    import routes_admin
    import routes_public
    logger.info("✅ Route modules loaded")
except Exception as e:
    logger.error(f"❌ Failed to import routes: {str(e)}")
    raise

# ============================================================
# HEALTH CHECK ENDPOINT
# ============================================================

@app.get("/api/health")
async def health_check():
    """
    Health check endpoint for monitoring
    Returns database status
    """
    db_status = "connected" if database is not None else "disconnected"
    
    health_info = {
        "status": "ok",
        "database": db_status,
        "environment": {
            "db_name": DB_NAME,
            "cors_origins": cors_origins_list
        }
    }
    
    if database is None:
        health_info["status"] = "degraded"
        health_info["warning"] = "Database connection not available"
    
    return health_info

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Romantic Proposal API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

# ============================================================
# AUTH ROUTER
# ============================================================

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])

@auth_router.post("/login", response_model=Token)
async def login(login_data: AdminLogin):
    """
    Admin login endpoint
    Hardcoded credentials for simplicity
    """
    logger.info(f"🔐 Login attempt for: {login_data.email}")
    
    # Hardcoded check
    if login_data.email == "kolashankar113@gmail.com" and login_data.password == "Shankar@113":
        access_token = create_access_token(data={"sub": login_data.email})
        logger.info(f"✅ Login successful for: {login_data.email}")
        return {"access_token": access_token, "token_type": "bearer"}
    
    logger.warning(f"❌ Login failed for: {login_data.email}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password"
    )

# ============================================================
# REGISTER ROUTERS
# ============================================================

app.include_router(auth_router)
app.include_router(routes_admin.router)
app.include_router(routes_public.router)

logger.info("✅ All routers registered")

# ============================================================
# MAKE DATABASE AVAILABLE TO ROUTES
# ============================================================

def get_db():
    """Helper function to get database instance"""
    return database

# Expose database getter for routes
app.state.get_db = get_db

logger.info("=" * 60)
logger.info("✅ SERVER INITIALIZATION COMPLETE")
logger.info("=" * 60)
