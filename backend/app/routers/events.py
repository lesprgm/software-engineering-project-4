from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.event import Event
from ..models.event_interest import EventInterest
from ..schemas.ai import EventNLPResponse
from ..schemas.event import EventUpdate, InterestInfo, InterestToggleRequest
from ..schemas.events import EventCreate, EventQueryFilters, EventRead
from ..services.ai_service import AIService
from ..services.events import EventService

router = APIRouter(prefix="/events", tags=["events"])


@router.post("/", response_model=EventRead, status_code=201)
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


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: int, db: Session = Depends(get_db)) -> EventRead:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/{event_id}", response_model=EventRead)
def update_event(event_id: int, payload: EventUpdate, db: Session = Depends(get_db)) -> EventRead:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    data = payload.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(event, key, value)

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)) -> None:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()
    return None


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


@router.post("/{event_id}/interests", response_model=InterestInfo)
def toggle_interest(event_id: int, req: InterestToggleRequest, db: Session = Depends(get_db)) -> InterestInfo:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = (
        db.query(EventInterest)
        .filter(EventInterest.event_id == event_id, EventInterest.user_id == req.user_id)
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
    else:
        new_interest = EventInterest(event_id=event_id, user_id=req.user_id)
        db.add(new_interest)
        db.commit()

    count = db.query(EventInterest).filter(EventInterest.event_id == event_id).count()
    return InterestInfo(event_id=event_id, interested_count=count)


@router.get("/{event_id}/interests", response_model=InterestInfo)
def get_interest_info(event_id: int, db: Session = Depends(get_db)) -> InterestInfo:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    count = db.query(EventInterest).filter(EventInterest.event_id == event_id).count()
    return InterestInfo(event_id=event_id, interested_count=count)
