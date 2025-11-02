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

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
