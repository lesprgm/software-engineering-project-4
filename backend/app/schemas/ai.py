from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator

from .events import EventRead


class ParticipantProfile(BaseModel):
    name: str
    bio: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    shared_activities: List[str] = Field(default_factory=list)

    @validator("interests", "shared_activities", pre=True, always=True)
    def _coerce_list(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


class MatchInsightRequest(BaseModel):
    participants: List[ParticipantProfile] = Field(..., min_items=2)
    shared_interests: List[str] = Field(default_factory=list)
    shared_activities: List[str] = Field(default_factory=list)
    mood: Optional[str] = None
    location: Optional[str] = None


class MatchInsightResponse(BaseModel):
    match_id: str
    summary_text: str
    generated_at: datetime
    cached: bool = False
    moderation_applied: bool = False

    class Config:
        orm_mode = True


class DateIdeaWindow(BaseModel):
    start: datetime
    end: datetime

    @validator("end")
    def end_after_start(cls, value, values):
        start = values.get("start")
        if start and value <= start:
            raise ValueError("availability window end must be after start")
        return value


class DateIdeaRequest(BaseModel):
    match_id: str = Field(..., description="Identifier for the match or group connection")
    shared_interests: List[str] = Field(default_factory=list)
    location: Optional[str] = Field(default=None, description="Campus or city anchor point")
    availability_window: Optional[DateIdeaWindow] = None
    mood: Optional[str] = None
    weather: Optional[str] = None
    participants: List[ParticipantProfile] = Field(default_factory=list)


class DateIdea(BaseModel):
    id: int
    match_id: str
    title: str
    description: str
    location: Optional[str]
    idea_rank: int
    generated_at: datetime
    expires_at: datetime

    class Config:
        orm_mode = True


class DateIdeasResponse(BaseModel):
    match_id: str
    ideas: List[DateIdea]
    cached: bool = False
    generated_at: datetime


class EventFilterDateRange(BaseModel):
    start: Optional[datetime] = None
    end: Optional[datetime] = None


class EventFilters(BaseModel):
    date_range: Optional[EventFilterDateRange] = None
    location: Optional[str] = None
    category: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)


class EventNLPResponse(BaseModel):
    query: str
    filters: EventFilters
    events: List[EventRead]
    cached: bool = False
    interpreted_query: str
    generated_at: datetime
