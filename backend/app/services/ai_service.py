from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import AICacheEntry, Event, MatchIdea, MatchInsight, Place
from ..schemas.ai import (
    DateIdea,
    DateIdeaRequest,
    EventFilterDateRange,
    EventFilters,
    MatchInsightRequest,
)
from .ai_client import AIClient, ModerationResult

settings = get_settings()
ai_client = AIClient(settings)


class AIService:
    """Domain-specific helpers for AI-powered features."""

    @classmethod
    def upsert_match_insight(
        cls,
        db: Session,
        match_id: str,
        payload: MatchInsightRequest,
    ) -> tuple[MatchInsight, bool]:
        fingerprint = cls._fingerprint(payload.dict())
        record = cls._get_match_insight(db, match_id)
        if record and record.input_fingerprint == fingerprint:
            if not cls._is_expired(record.generated_at, hours=settings.ai_insight_ttl_hours):
                return record, True

        prompt = cls._build_match_prompt(payload)
        summary, moderation_meta = cls._generate_and_moderate(prompt)

        snapshot = cls._snapshot_payload(payload.dict())
        if record is None:
            record = MatchInsight(
                match_id=match_id,
                summary_text=summary,
                context_snapshot=snapshot,
                input_fingerprint=fingerprint,
                moderation_labels=moderation_meta,
            )
            db.add(record)
        else:
            record.summary_text = summary
            record.generated_at = datetime.now(timezone.utc)
            record.context_snapshot = snapshot
            record.input_fingerprint = fingerprint
            record.moderation_labels = moderation_meta
        db.flush()
        return record, False

    @classmethod
    def get_match_insight(cls, db: Session, match_id: str, *, refresh: bool = False) -> tuple[MatchInsight, bool]:
        record = cls._get_match_insight(db, match_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No insight cached for this match. Submit a POST with participant context first.",
            )

        needs_refresh = refresh or cls._is_expired(record.generated_at, hours=settings.ai_insight_ttl_hours)
        if not needs_refresh:
            return record, True

        payload = MatchInsightRequest(**record.context_snapshot)
        return cls.upsert_match_insight(db, match_id, payload)

    @classmethod
    def generate_date_ideas(cls, db: Session, payload: DateIdeaRequest) -> tuple[list[MatchIdea], bool]:
        fingerprint = cls._fingerprint(payload.dict())
        existing = cls._get_match_ideas(db, payload.match_id)
        if (
            existing
            and existing[0].payload_fingerprint == fingerprint
            and not cls._ideas_expired(existing)
        ):
            return existing, True

        ideas_payloads = cls._create_date_ideas_payload(payload, cls._list_places(db))
        if not ideas_payloads:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to craft ideas")

        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.ai_idea_ttl_days)
        snapshot = cls._snapshot_payload(payload.dict())
        db.execute(delete(MatchIdea).where(MatchIdea.match_id == payload.match_id))
        db.flush()

        records: list[MatchIdea] = []
        for idx, idea in enumerate(ideas_payloads):
            record = MatchIdea(
                match_id=payload.match_id,
                idea_rank=idx,
                title=idea["title"],
                description=idea["description"],
                location_hint=idea.get("location"),
                expires_at=expires_at,
                payload_fingerprint=fingerprint,
                context_snapshot=snapshot,
            )
            db.add(record)
            records.append(record)
        db.flush()
        return records, False

    @classmethod
    def list_date_ideas(cls, db: Session, match_id: str, *, refresh: bool = False) -> tuple[list[MatchIdea], bool]:
        ideas = cls._get_match_ideas(db, match_id)
        if not ideas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No ideas cached for this match. Submit a POST to /ideas first.",
            )

        needs_refresh = refresh or cls._ideas_expired(ideas)
        if not needs_refresh:
            return ideas, True

        request_payload = DateIdeaRequest(**ideas[0].context_snapshot)
        return cls.generate_date_ideas(db, request_payload)

    @classmethod
    def interpret_event_query(
        cls,
        db: Session,
        query: str,
        *,
        refresh: bool = False,
    ) -> tuple[EventFilters, list[Event], bool, str]:
        cache_key = cls._fingerprint({"query": query})
        cached = cls._get_cache(db, "event_search", cache_key)
        if cached and not refresh:
            filters = cls._filters_from_payload(cached.payload.get("filters", {}))
            interpreted = cached.payload.get("interpreted_query", query)
            events = cls._filter_events(db, filters)
            return filters, events, True, interpreted

        filters_dict = cls._call_llm_for_filters(query) or cls._heuristic_filters(query)
        filters = cls._filters_from_payload(filters_dict)
        interpreted_query = filters_dict.get("summary") or query
        cls._set_cache(
            db,
            category="event_search",
            cache_key=cache_key,
            payload={"filters": filters_dict, "interpreted_query": interpreted_query},
        )
        events = cls._filter_events(db, filters)
        return filters, events, False, interpreted_query

    # --- Match helpers -----------------------------------------------------------
    @classmethod
    def _get_match_insight(cls, db: Session, match_id: str) -> MatchInsight | None:
        return (
            db.execute(select(MatchInsight).where(MatchInsight.match_id == match_id))
            .scalar_one_or_none()
        )

    @classmethod
    def _build_match_prompt(cls, payload: MatchInsightRequest) -> str:
        participant_lines = []
        for participant in payload.participants:
            interests = ", ".join(participant.interests) or "unknown interests"
            activities = ", ".join(participant.shared_activities) or "campus life"
            participant_lines.append(
                f"- {participant.name}: {participant.bio or 'No bio provided'}. Interests: {interests}. Activities: {activities}."
            )
        shared = ", ".join(payload.shared_interests) or "community vibes"
        mood = payload.mood or "optimistic"
        location = payload.location or "campus"
        return (
            "Craft a short (2 sentences) friendly explanation of why these people vibe well.\n"
            f"Tone should be {mood}, referencing local {location} details and shared interests.\n"
            f"Shared interests: {shared}.\nParticipants:\n" + "\n".join(participant_lines)
        )

    @classmethod
    def _generate_and_moderate(cls, prompt: str) -> tuple[str, dict | None]:
        raw_text = ai_client.generate_text(prompt, max_tokens=200)
        moderation: ModerationResult | None = None
        sanitized = raw_text
        if settings.ai_require_moderation:
            moderation = ai_client.moderate_text(raw_text)
            if moderation.flagged:
                sanitized = "[content removed for safety]"
        return sanitized.strip(), moderation.metadata if moderation else None

    # --- Idea helpers ------------------------------------------------------------
    @classmethod
    def _list_places(cls, db: Session, limit: int = 5) -> list[Place]:
        return (
            db.execute(select(Place).limit(limit))
            .scalars()
            .all()
        )

    @classmethod
    def _create_date_ideas_payload(
        cls,
        payload: DateIdeaRequest,
        places: Sequence[Place],
    ) -> list[dict]:
        prompt = cls._build_ideas_prompt(payload, places)
        raw = ai_client.generate_text(prompt, max_tokens=500)
        parsed = cls._parse_ideas(raw)
        if not parsed:
            parsed = cls._fallback_ideas(payload, places)
        return parsed[:3]

    @classmethod
    def _build_ideas_prompt(cls, payload: DateIdeaRequest, places: Sequence[Place]) -> str:
        interests = ", ".join(payload.shared_interests) or "exploring campus"
        window = ""
        if payload.availability_window:
            window = f"Available between {payload.availability_window.start.isoformat()} and {payload.availability_window.end.isoformat()}."
        place_lines = []
        for place in places:
            place_lines.append(f"{place.name} - {place.description or 'student favorite'} ({place.location})")
        place_blob = "\n".join(place_lines) or "Student union, campus green, library courtyard"
        return (
            "You are a campus concierge. Provide 3 JSON ideas with fields title, description, location.\n"
            f"Shared interests: {interests}. Mood: {payload.mood or 'playful'}. Weather: {payload.weather or 'clear'}.\n"
            f"{window}\n"
            f"Available places:\n{place_blob}\n"
            "Respond with a JSON array."
        )

    @staticmethod
    def _parse_ideas(raw: str) -> list[dict]:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
        start = raw.find("[")
        end = raw.rfind("]")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                return []
        return []

    @staticmethod
    def _fallback_ideas(payload: DateIdeaRequest, places: Sequence[Place]) -> list[dict]:
        ideas: list[dict] = []
        interests = payload.shared_interests or ["new experiences"]
        base_locations = [place.name for place in places] or ["Campus Green", "Student Union", "Innovation Lab"]
        for idx in range(3):
            location = base_locations[idx % len(base_locations)]
            ideas.append(
                {
                    "title": f"{location} meetup",
                    "description": f"Meet at {location} to enjoy {interests[idx % len(interests)]}.",
                    "location": payload.location or location,
                }
            )
        return ideas

    # --- Event helpers -----------------------------------------------------------
    @classmethod
    def _call_llm_for_filters(cls, query: str) -> dict:
        prompt = (
            "Interpret the following natural language event query. "
            "Return JSON with keys summary, date_range {start,end}, location, category, keywords (list of strings).\n"
            f"Query: {query}"
        )
        raw = ai_client.generate_text(prompt, max_tokens=300)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    @classmethod
    def _heuristic_filters(cls, query: str) -> dict:
        lowered = query.lower()
        location = None
        match = re.search(r"(?:near|at|around)\s+([a-zA-Z ]+)", query)
        if match:
            location = match.group(1).strip(" ?!.")
        category = None
        for keyword, label in {
            "concert": "music",
            "music": "music",
            "party": "social",
            "game": "sports",
            "study": "academic",
            "volunteer": "service",
        }.items():
            if keyword in lowered:
                category = label
                break
        date_range = cls._extract_date_range(lowered)
        keywords = [word for word in ["friday", "tonight", "outdoors", "food"] if word in lowered]
        return {
            "summary": f"Query interpreted locally: {query}",
            "date_range": {
                "start": date_range[0].isoformat() if date_range and date_range[0] else None,
                "end": date_range[1].isoformat() if date_range and date_range[1] else None,
            },
            "location": location,
            "category": category,
            "keywords": keywords,
        }

    @staticmethod
    def _extract_date_range(lowered: str) -> tuple[datetime | None, datetime | None]:
        now = datetime.now(timezone.utc)
        weekday_map = {
            "monday": 0,
            "tuesday": 1,
            "wednesday": 2,
            "thursday": 3,
            "friday": 4,
            "saturday": 5,
            "sunday": 6,
        }
        for word, weekday in weekday_map.items():
            if word in lowered:
                days_ahead = (weekday - now.weekday()) % 7
                target_date = (now + timedelta(days=days_ahead)).date()
                start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                end = start + timedelta(days=1)
                return start, end
        if "tonight" in lowered:
            start = now.replace(hour=18, minute=0, second=0, microsecond=0)
            end = start + timedelta(hours=6)
            return start, end
        if "tomorrow" in lowered:
            start = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
            return start, end
        return None, None

    @classmethod
    def _filters_from_payload(cls, payload: dict) -> EventFilters:
        date_range = payload.get("date_range") or {}
        range_obj = None
        if date_range.get("start") or date_range.get("end"):
            range_obj = EventFilterDateRange(
                start=cls._parse_datetime(date_range.get("start")),
                end=cls._parse_datetime(date_range.get("end")),
            )
        return EventFilters(
            date_range=range_obj,
            location=payload.get("location"),
            category=payload.get("category"),
            keywords=payload.get("keywords") or [],
        )

    @staticmethod
    def _parse_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    @classmethod
    def _filter_events(cls, db: Session, filters: EventFilters) -> list[Event]:
        query = select(Event)
        if filters.date_range and filters.date_range.start:
            query = query.where(Event.start_time >= filters.date_range.start)
        if filters.date_range and filters.date_range.end:
            query = query.where(Event.start_time <= filters.date_range.end)
        if filters.location:
            query = query.where(Event.location.ilike(f"%{filters.location}%"))
        if filters.category:
            query = query.where(Event.category.ilike(f"%{filters.category}%"))
        return db.execute(query.order_by(Event.start_time.asc())).scalars().all()

    # --- Cache helpers -----------------------------------------------------------
    @classmethod
    def _get_cache(cls, db: Session, category: str, cache_key: str) -> AICacheEntry | None:
        entry = (
            db.execute(
                select(AICacheEntry).where(
                    AICacheEntry.category == category,
                    AICacheEntry.cache_key == cache_key,
                )
            )
            .scalar_one_or_none()
        )
        if entry and cls._ensure_utc(entry.expires_at) < datetime.now(timezone.utc):
            db.delete(entry)
            db.flush()
            return None
        return entry

    @classmethod
    def _set_cache(cls, db: Session, *, category: str, cache_key: str, payload: dict) -> None:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.ai_cache_ttl_minutes)
        db.execute(
            delete(AICacheEntry).where(
                AICacheEntry.category == category,
                AICacheEntry.cache_key == cache_key,
            )
        )
        entry = AICacheEntry(category=category, cache_key=cache_key, payload=payload, expires_at=expires_at)
        db.add(entry)
        db.flush()

    # --- Generic helpers ---------------------------------------------------------
    @staticmethod
    def _fingerprint(payload: dict) -> str:
        return sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()

    @classmethod
    def _is_expired(cls, moment: datetime, *, hours: int) -> bool:
        reference = cls._ensure_utc(moment)
        return datetime.now(timezone.utc) - reference > timedelta(hours=hours)

    @classmethod
    def _ideas_expired(cls, ideas: Sequence[MatchIdea]) -> bool:
        now = datetime.now(timezone.utc)
        return any(cls._ensure_utc(idea.expires_at) <= now for idea in ideas)

    @classmethod
    def _get_match_ideas(cls, db: Session, match_id: str) -> list[MatchIdea]:
        return (
            db.execute(
                select(MatchIdea)
                .where(MatchIdea.match_id == match_id)
                .order_by(MatchIdea.idea_rank.asc())
            )
            .scalars()
            .all()
        )

    @staticmethod
    def _ensure_utc(moment: datetime) -> datetime:
        if moment.tzinfo is None:
            return moment.replace(tzinfo=timezone.utc)
        return moment.astimezone(timezone.utc)

    @staticmethod
    def _snapshot_payload(payload: dict) -> dict:
        return json.loads(json.dumps(payload, default=str))
