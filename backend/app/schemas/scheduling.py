from datetime import datetime, timedelta
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class AvailabilityBase(BaseModel):
    start_time: datetime
    end_time: datetime
    timezone: str = "UTC"

    @validator("end_time")
    def validate_duration(cls, value: datetime, values: dict[str, datetime]) -> datetime:
        start = values.get("start_time")
        if start and value <= start:
            raise ValueError("end_time must be after start_time")
        return value


class AvailabilityCreate(AvailabilityBase):
    user_id: str


class AvailabilityRead(AvailabilityBase):
    id: int
    user_id: str
    group_id: str
    created_at: datetime

    class Config:
        orm_mode = True


class MeetingPreferences(BaseModel):
    duration_minutes: int = Field(60, ge=15, le=240)
    window_days: int = Field(14, ge=1, le=30)
    limit: int = Field(5, ge=1, le=20)


class MeetingSuggestion(BaseModel):
    start_time: datetime
    end_time: datetime
    participant_ids: List[str]
    conflicts: List[str] = Field(default_factory=list)


class MeetingSuggestionResponse(BaseModel):
    group_id: str
    suggestions: List[MeetingSuggestion]
    preferences: MeetingPreferences


class MeetingConfirmationRequest(BaseModel):
    suggestion_start: datetime
    suggestion_end: datetime
    suggested_by: Optional[str] = None
    note: Optional[str] = None
