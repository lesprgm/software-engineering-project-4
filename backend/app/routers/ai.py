from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.ai import (
    DateIdeaRequest,
    DateIdeasResponse,
    DirectChatRequest,
    DirectChatResponse,
    MatchInsightRequest,
    MatchInsightResponse,
)
from ..services.ai_service import AIService

router = APIRouter(tags=["ai"])


@router.post("/matches/{match_id}/insight", response_model=MatchInsightResponse)
def create_match_insight(
    match_id: str,
    request: MatchInsightRequest,
    db: Session = Depends(get_db),
) -> MatchInsightResponse:
    record, cached = AIService.upsert_match_insight(db, match_id, request)
    if not cached:
        db.commit()
    return MatchInsightResponse(
        match_id=record.match_id,
        summary_text=record.summary_text,
        generated_at=record.generated_at,
        cached=cached,
        moderation_applied=bool(record.moderation_labels),
    )


@router.get("/matches/{match_id}/insight", response_model=MatchInsightResponse)
def read_match_insight(
    match_id: str,
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
) -> MatchInsightResponse:
    record, cached = AIService.get_match_insight(db, match_id, refresh=refresh)
    if not cached:
        db.commit()
    return MatchInsightResponse(
        match_id=record.match_id,
        summary_text=record.summary_text,
        generated_at=record.generated_at,
        cached=cached,
        moderation_applied=bool(record.moderation_labels),
    )


@router.post("/ideas", response_model=DateIdeasResponse)
def generate_date_ideas(
    request: DateIdeaRequest,
    db: Session = Depends(get_db),
) -> DateIdeasResponse:
    records, cached = AIService.generate_date_ideas(db, request)
    if not cached:
        db.commit()
    generated_at = records[0].generated_at if records else None
    return DateIdeasResponse(
        match_id=request.match_id,
        ideas=records,
        cached=cached,
        generated_at=generated_at,
    )


@router.get("/ideas", response_model=DateIdeasResponse)
def list_date_ideas(
    match_id: str = Query(..., description="Match identifier to retrieve cached ideas for"),
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
) -> DateIdeasResponse:
    records, cached = AIService.list_date_ideas(db, match_id, refresh=refresh)
    if not cached:
        db.commit()
    generated_at = records[0].generated_at if records else None
    return DateIdeasResponse(
        match_id=match_id,
        ideas=records,
        cached=cached,
        generated_at=generated_at,
    )


@router.post("/chat/direct", response_model=DirectChatResponse)
def chat_with_ai(request: DirectChatRequest) -> DirectChatResponse:
    reply = AIService.generate_direct_reply(request)
    return DirectChatResponse(reply_text=reply)
