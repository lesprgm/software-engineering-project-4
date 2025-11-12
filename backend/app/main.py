import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, SessionLocal, engine
from .models.user import User
from .services.events import EventService
from app.routers import ai, auth, direct_messages, events, groups, matches, places, users

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()
LOCALHOST_CORS_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

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

        if "latitude" not in place_columns:
            connection.execute(text("ALTER TABLE places ADD COLUMN latitude FLOAT"))
        if "longitude" not in place_columns:
            connection.execute(text("ALTER TABLE places ADD COLUMN longitude FLOAT"))
        if "created_at" not in place_columns:
            connection.execute(
                text(
                    "ALTER TABLE places ADD COLUMN created_at DATETIME NOT NULL DEFAULT (datetime('now'))"
                )
            )
        if "updated_at" not in place_columns:
            connection.execute(
                text(
                    "ALTER TABLE places ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (datetime('now'))"
                )
            )

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

        user_columns = get_columns(connection, "users")
        if "password_hash" not in user_columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")
            )
        if "bio" not in user_columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN bio TEXT")
            )
        if "interests" not in user_columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN interests TEXT DEFAULT '[]'")
            )
        if "photos" not in user_columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN photos TEXT DEFAULT '[]'")
            )
        if "pronouns" not in user_columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN pronouns TEXT")
            )
        if "location" not in user_columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN location TEXT")
            )
        if "updated_at" not in user_columns:
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (datetime('now'))"
                )
            )


apply_schema_patches()


def _ensure_demo_user(session: Session) -> None:
    """Seed a friendly dev user so local features (groups, matches) function immediately."""
    demo_profiles = [
        {
            "email": "dev@example.edu",
            "display_name": "Dev User",
            "bio": "Default campus connector profile for local testing.",
            "interests": ["coffee", "hackathons", "sunset walks"],
            "pronouns": "they/them",
            "location": "Innovation Lab",
        },
    ]
    created = False
    for profile in demo_profiles:
        exists = session.execute(select(User).where(User.email == profile["email"])).scalar_one_or_none()
        if exists:
            continue
        user = User(
            email=profile["email"],
            display_name=profile["display_name"],
            bio=profile["bio"],
            interests=profile["interests"],
            pronouns=profile["pronouns"],
            location=profile["location"],
        )
        session.add(user)
        created = True
    if created:
        session.commit()


def seed_default_records() -> None:
    session: Session = SessionLocal()
    try:
        EventService.seed_defaults(session)
        _ensure_demo_user(session)
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
    allow_origin_regex=LOCALHOST_CORS_REGEX,
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
