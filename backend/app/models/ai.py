from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MatchInsight(Base):
    __tablename__ = "match_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    input_fingerprint: Mapped[str] = mapped_column(String, nullable=False)
    context_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    moderation_labels: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class MatchIdea(Base):
    __tablename__ = "match_ideas"
    __table_args__ = (UniqueConstraint("match_id", "idea_rank", name="uq_match_idea_rank"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    idea_rank: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location_hint: Mapped[str | None] = mapped_column(String, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload_fingerprint: Mapped[str] = mapped_column(String, nullable=False)
    context_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, default="ai")


class AICacheEntry(Base):
    __tablename__ = "ai_cache_entries"
    __table_args__ = (UniqueConstraint("category", "cache_key", name="uq_ai_cache_category_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)
    cache_key: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
