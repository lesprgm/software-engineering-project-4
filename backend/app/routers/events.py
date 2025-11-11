from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.ai import EventFilters, EventNLPResponse
from ..schemas.events import EventCreate, EventQueryFilters, EventRead
from ..services.ai_service import AIService
from ..services.events import EventService

router = APIRouter(prefix="/events", tags=["events"])


@router.post("/", response_model=EventRead)
def create_event(payload: EventCreate, db: Session = Depends(get_db)) -> EventRead:
    event = EventService.create_event(db, payload)
    db.commit()
    db.refresh(event)
    return event


@router.get("/", response_model=list[EventRead])
def list_events(
    start_time: datetime | None = Query(None),
    end_time: datetime | None = Query(None),
    location: str | None = Query(None),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[EventRead]:
    filters = EventQueryFilters(
        start_time=start_time,
        end_time=end_time,
        location=location,
        category=category,
    )
    events = EventService.list_events(db, filters)
    return events


@router.get("/nlp-search", response_model=EventNLPResponse)
def nlp_event_search(
    q: str = Query(..., description="Natural-language search query"),
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
) -> EventNLPResponse:
    filters, events, cached, interpreted = AIService.interpret_event_query(db, q, refresh=refresh)
    if not cached:
        db.commit()
    return EventNLPResponse(
        query=q,
        filters=filters,
        events=events,
        cached=cached,
        interpreted_query=interpreted,
        generated_at=datetime.now(timezone.utc),
    )
