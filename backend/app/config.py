from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import BaseSettings, Field, validator

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = BASE_DIR / 'app.db'
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
SQLITE_PREFIX = "sqlite:///"


class Settings(BaseSettings):
    database_url: str = Field(
        default=DEFAULT_SQLITE_URL,
        env="DATABASE_URL",
        description="SQLAlchemy compatible database URL.",
    )
    jwt_secret: Optional[str] = Field(
        default=None,
        env="JWT_SECRET",
        description="Secret key used for JWT signing when auth is enabled.",
    )
    default_meeting_duration_minutes: int = Field(
        default=60,
        description="Default meeting length used when the client omits a duration.",
    )
    meeting_window_days: int = Field(
        default=14,
        description="How many days ahead the scheduler searches for availabilities.",
    )
    gemini_api_key: Optional[str] = Field(
        default=None,
        env="GEMINI_API_KEY",
        description="API key for Gemini endpoints.",
    )
    gemini_model: str = Field(
        default="gemini-2.5-flash",
        env="GEMINI_MODEL",
        description="Default Gemini model identifier.",
    )
    ai_cache_ttl_minutes: int = Field(
        default=60 * 24 * 7,
        env="AI_CACHE_TTL_MINUTES",
        description="Minutes an AI cache entry remains valid.",
    )
    ai_idea_ttl_days: int = Field(
        default=7,
        env="AI_IDEA_TTL_DAYS",
        description="Days date ideas remain cached before regeneration.",
    )
    ai_insight_ttl_hours: int = Field(
        default=24,
        env="AI_INSIGHT_TTL_HOURS",
        description="Hours match insights remain cached before regeneration.",
    )
    ai_require_moderation: bool = Field(
        default=True,
        env="AI_REQUIRE_MODERATION",
        description="Whether to run moderation on AI-generated text.",
    )
    media_root: str = Field(
        default="uploads",
        env="MEDIA_ROOT",
        description="Filesystem directory for uploaded media.",
    )
    media_base_url: str = Field(
        default="/uploads",
        env="MEDIA_BASE_URL",
        description="Base URL path for serving uploaded media.",
    )
    max_photo_size: int = Field(
        default=5 * 1024 * 1024,
        env="MAX_PHOTO_SIZE",
        description="Maximum allowed size for profile photo uploads in bytes.",
    )
    cors_allow_origins: List[str] | str = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        env="CORS_ALLOW_ORIGINS",
        description="Comma-separated origins allowed for CORS.",
    )

    @validator('database_url', pre=True)
    def _normalize_database_url(cls, value: Optional[str]) -> str:
        if not value:
            return DEFAULT_SQLITE_URL
        trimmed = value.strip()
        if trimmed in {"sqlite:///:memory:", "sqlite://", "sqlite:"}:
            return trimmed
        if trimmed.startswith(SQLITE_PREFIX):
            path_part = trimmed[len(SQLITE_PREFIX):]
            path = Path(path_part)
            if not path.is_absolute():
                path = (BASE_DIR / path).resolve()
            return f"sqlite:///{path.as_posix()}"
        return trimmed

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.cors_allow_origins, list):
            return self.cors_allow_origins
        value = self.cors_allow_origins.strip()
        if not value:
            return ["http://localhost:5173", "http://127.0.0.1:5173"]
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
