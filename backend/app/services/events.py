from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Event, EventInterest
from ..schemas.events import EventCreate, EventInterestRequest, EventQueryFilters, EventUpdate


class EventService:
    _SEED_EVENTS = [
        {
            "title": "Hack Night",
            "description": "Bring your laptop for a collaborative late-night build sprint with snacks and lo-fi playlists.",
            "location": "Innovation Lab",
            "category": "tech",
            "offset_hours": 24,
            "duration_hours": 4,
            "tags": ["tech", "coding"],
        },
        {
            "title": "Campus Sunset Picnic",
            "description": "Meet by the quad for chill vibes, board games, and sunset photos.",
            "location": "South Quad Lawn",
            "category": "social",
            "offset_hours": 48,
            "duration_hours": 2,
            "tags": ["outdoors", "picnic"],
        },
        {
            "title": "Open Mic & Coffee",
            "description": "Acoustic performances, poetry, and $2 espresso flights all evening.",
            "location": "Campus Cafe",
            "category": "music",
            "offset_hours": 72,
            "duration_hours": 3,
            "tags": ["music", "coffee"],
        },
    ]

    @staticmethod
    def _serialize_tags(tags: list[str] | None) -> str | None:
        if not tags:
            return None
        cleaned = [tag.strip() for tag in tags if isinstance(tag, str) and tag.strip()]
        return ",".join(cleaned) if cleaned else None

    @staticmethod
    def create_event(db: Session, payload: EventCreate) -> Event:
        end_time = payload.end_time or (payload.start_time + timedelta(hours=1))
        event = Event(
            title=payload.title,
            description=payload.description,
            location=payload.location,
            category=payload.category or "general",
            start_time=payload.start_time,
            end_time=end_time,
            tags=EventService._serialize_tags(payload.tags),
        )
        db.add(event)
        db.flush()
        db.refresh(event)
        return event

    @staticmethod
    def update_event(db: Session, event_id: int, payload: EventUpdate) -> Event | None:
        event = db.get(Event, event_id)
        if event is None:
            return None
        data = payload.dict(exclude_unset=True)
        if "category" in data:
            data["category"] = data["category"] or "general"
        if "tags" in data:
            data["tags"] = EventService._serialize_tags(data["tags"])
        for field, value in data.items():
            setattr(event, field, value)
        db.add(event)
        db.flush()
        db.refresh(event)
        return event

    @staticmethod
    def list_events(
        db: Session,
        filters: EventQueryFilters | None = None,
        viewer_id: str | None = None,
    ) -> list[Event]:
        query = select(Event)
        if filters:
            if filters.start_time:
                query = query.where(Event.start_time >= filters.start_time)
            if filters.end_time:
                query = query.where(Event.start_time <= filters.end_time)
            if filters.location:
                query = query.where(Event.location.ilike(f"%{filters.location}%"))
            if filters.category:
                query = query.where(Event.category.ilike(f"%{filters.category}%"))
        query = query.order_by(Event.start_time.asc())
        events = db.execute(query).scalars().all()
        if not events:
            return []

        ids = [event.id for event in events]
        count_rows = (
            db.execute(
                select(EventInterest.event_id, func.count())
                .where(EventInterest.event_id.in_(ids))
                .where(EventInterest.interested.is_(True))
                .group_by(EventInterest.event_id)
            )
            .all()
        )
        counts = {event_id: total for event_id, total in count_rows}
        viewer_map = set()
        if viewer_id:
            viewer_rows = (
                db.execute(
                    select(EventInterest.event_id)
                    .where(EventInterest.event_id.in_(ids))
                    .where(EventInterest.user_id == viewer_id)
                    .where(EventInterest.interested.is_(True))
                )
                .scalars()
                .all()
            )
            viewer_map = set(viewer_rows)

        for event in events:
            setattr(event, "interest_count", counts.get(event.id, 0))
            setattr(event, "viewer_interest", event.id in viewer_map)
        return events

    @staticmethod
    def set_interest(db: Session, event_id: int, payload: EventInterestRequest) -> EventInterest:
        interest = (
            db.execute(
                select(EventInterest)
                .where(EventInterest.event_id == event_id)
                .where(EventInterest.user_id == payload.user_id)
            )
            .scalar_one_or_none()
        )
        if interest is None:
            interest = EventInterest(
                event_id=event_id,
                user_id=payload.user_id,
                interested=payload.interested,
            )
            db.add(interest)
        else:
            interest.interested = payload.interested
            db.add(interest)
        db.flush()
        db.refresh(interest)
        return interest

    @staticmethod
    def get_interest(db: Session, event_id: int, user_id: str) -> EventInterest | None:
        return (
            db.execute(
                select(EventInterest)
                .where(EventInterest.event_id == event_id)
                .where(EventInterest.user_id == user_id)
            )
            .scalar_one_or_none()
        )

    @staticmethod
    def interest_count(db: Session, event_id: int) -> int:
        return (
            db.execute(
                select(func.count())
                .where(EventInterest.event_id == event_id)
                .where(EventInterest.interested.is_(True))
            )
            .scalar_one()
        )

    @classmethod
    def seed_defaults(cls, db: Session) -> None:
        existing = db.execute(select(func.count(Event.id))).scalar_one()
        if existing:
            return
        now = datetime.now(timezone.utc)
        for idx, template in enumerate(cls._SEED_EVENTS):
            start = now + timedelta(hours=template["offset_hours"])
            end = start + timedelta(hours=template["duration_hours"])
            event = Event(
                title=template["title"],
                description=template["description"],
                location=template["location"],
                category=template["category"],
                start_time=start,
                end_time=end,
                tags=cls._serialize_seed_tags(template.get("tags")),
            )
            db.add(event)
        db.commit()

    @staticmethod
    def _serialize_seed_tags(tags: list[str] | None) -> str | None:
        if not tags:
            return None
        return ",".join(tags)
