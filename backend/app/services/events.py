from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Event
from ..schemas.events import EventCreate, EventQueryFilters


class EventService:
    """Simple CRUD helpers for campus events."""

    @staticmethod
    def create_event(db: Session, payload: EventCreate) -> Event:
        event = Event(
            title=payload.title,
            description=payload.description,
            location=payload.location,
            category=payload.category,
            start_time=payload.start_time,
            end_time=payload.end_time,
            tags=",".join(payload.tags),
        )
        db.add(event)
        db.flush()
        db.refresh(event)
        return event

    @staticmethod
    def list_events(db: Session, filters: EventQueryFilters | None = None) -> list[Event]:
        query = select(Event)
        if filters:
            if filters.start_time:
                query = query.where(Event.start_time >= filters.start_time)
            if filters.end_time:
                query = query.where(Event.start_time <= filters.end_time)
            if filters.location:
                query = query.where(Event.location.contains(filters.location))
            if filters.category:
                query = query.where(Event.category.contains(filters.category))
        query = query.order_by(Event.start_time.asc())
        return db.execute(query).scalars().all()
