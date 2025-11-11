from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from .config import get_settings
from .database import Base, engine
from app.routers import ai, events, groups, matches, places

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

# Create database tables on startup for local development.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Campus Connect API",
    version="0.1.0",
    description="Backend services for campus social scheduling.",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# Include routers
app.include_router(groups.router)
app.include_router(places.router)
app.include_router(ai.router)
app.include_router(events.router, prefix="/api")
app.include_router(matches.router)


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str]:
    """Health check endpoint for monitoring."""
    return {"status": "ok"}


@app.get("/", tags=["root"])
def root() -> dict[str, str]:
    """Root endpoint with API information."""
    return {
        "name": "Campus Connect API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health"
    }
