from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging
from sqlalchemy import text

from .config import get_settings
from .database import Base, SessionLocal, engine
from .services.events import EventService
from app.routers import ai, auth, direct_messages, events, groups, matches, places, users

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

# Create database tables on startup for local development.
Base.metadata.create_all(bind=engine)


def apply_schema_patches() -> None:
    def get_columns(conn, table: str) -> set[str]:
        rows = conn.execute(text(f"PRAGMA table_info('{table}')")).fetchall()
        return {row[1] for row in rows}

    with engine.begin() as connection:
        place_columns = get_columns(connection, "places")
        if "review_count" not in place_columns:
            connection.execute(text("ALTER TABLE places ADD COLUMN review_count INTEGER DEFAULT 0"))

        event_columns = get_columns(connection, "events")
        if "created_at" not in event_columns:
            connection.execute(
                text(
                    "ALTER TABLE events ADD COLUMN created_at DATETIME NOT NULL DEFAULT (datetime('now'))"
                )
            )

        if "updated_at" not in event_columns:
            connection.execute(
                text(
                    "ALTER TABLE events ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (datetime('now'))"
                )
            )


apply_schema_patches()
def seed_default_records() -> None:
    session = SessionLocal()
    try:
        EventService.seed_defaults(session)
    finally:
        session.close()


seed_default_records()
media_path = Path(settings.media_root).resolve()
media_path.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Campus Connect API",
    version="0.1.0",
    description="Backend services for campus social scheduling.",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(places.router)
app.include_router(ai.router)
app.include_router(events.router)
app.include_router(events.router, prefix="/api")
app.include_router(matches.router)
app.include_router(users.router)
app.include_router(direct_messages.router)

media_url_path = settings.media_base_url
if not media_url_path.startswith("/"):
    media_url_path = f"/{media_url_path}"
app.mount(media_url_path, StaticFiles(directory=media_path), name="media")


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
