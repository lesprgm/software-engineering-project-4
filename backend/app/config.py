from functools import lru_cache
from typing import Optional

from pydantic import BaseSettings, Field


class Settings(BaseSettings):

    database_url: str = Field(
        default="sqlite:///./app.db",
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

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
