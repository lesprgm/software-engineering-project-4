from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Event
from ..schemas.ai import EventNLPResponse
from ..schemas.events import (
    EventCreate,
    EventInterestRead,
    EventInterestRequest,
    EventQueryFilters,
    EventRead,
    EventUpdate,
)
from ..services.ai_service import AIService
from ..services.events import EventService

router = APIRouter(prefix="/events", tags=["events"])


@router.post("/", response_model=EventRead, status_code=status.HTTP_201_CREATED)
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
    viewer_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[EventRead]:
    filters = EventQueryFilters(
        start_time=start_time,
        end_time=end_time,
        location=location,
        category=category,
    )
    events = EventService.list_events(db, filters=filters, viewer_id=viewer_id)
    return events


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: int, db: Session = Depends(get_db)) -> EventRead:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.put("/{event_id}", response_model=EventRead)
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
) -> EventRead:
    event = EventService.update_event(db, event_id, payload)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)) -> None:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    db.delete(event)
    db.commit()
    return None


@router.post(
    "/{event_id}/interest",
    response_model=EventInterestRead,
    status_code=status.HTTP_201_CREATED,
)
def set_interest(
    event_id: int,
    payload: EventInterestRequest,
    db: Session = Depends(get_db),
) -> EventInterestRead:
    if not db.get(Event, event_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    interest = EventService.set_interest(db, event_id, payload)
    db.commit()
    return EventInterestRead(event_id=event_id, user_id=payload.user_id, interested=interest.interested)


@router.get("/{event_id}/interest", response_model=EventInterestRead)
def get_interest(
    event_id: int,
    user_id: str = Query(..., description="User identifier"),
    db: Session = Depends(get_db),
) -> EventInterestRead:
    interest = EventService.get_interest(db, event_id, user_id)
    if interest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interest not found")
    return EventInterestRead(event_id=event_id, user_id=user_id, interested=interest.interested)


@router.get("/nlp-search", response_model=EventNLPResponse)
def nlp_event_search(
    q: str = Query(..., description="Natural-language search query"),
    refresh: bool = Query(False),
    viewer_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> EventNLPResponse:
    filters, events, cached, interpreted = AIService.interpret_event_query(
        db,
        q,
        refresh=refresh,
        viewer_id=viewer_id,
    )
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
