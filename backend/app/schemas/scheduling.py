from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class AvailabilityBase(BaseModel):
    start_time: datetime
    end_time: datetime
    timezone: str = Field(default="UTC", min_length=1)

    @validator("end_time")
    def validate_duration(cls, value: datetime, values: dict[str, datetime]) -> datetime:
        start = values.get("start_time")
        if start and value <= start:
            raise ValueError("end_time must be after start_time")
        return value

    @validator("timezone")
    def validate_timezone(cls, v):
        if not v or not v.strip():
            return "UTC"
        return v.strip()


class AvailabilityCreate(AvailabilityBase):
    user_id: str | None = Field(default=None, min_length=1)


class AvailabilityRead(AvailabilityBase):
    id: int
    user_id: str
    group_id: str
    created_at: datetime

    class Config:
        orm_mode = True


class MeetingPreferences(BaseModel):
    duration_minutes: int = Field(60, ge=15, le=240, description="Meeting duration in minutes")
    window_days: int = Field(14, ge=1, le=30, description="Days ahead to search for availability")
    limit: int = Field(5, ge=1, le=20, description="Maximum number of suggestions to return")


class MeetingSuggestion(BaseModel):
    start_time: datetime
    end_time: datetime
    participant_ids: List[str]
    conflicts: List[str] = Field(default_factory=list, description="User IDs with conflicts")


class MeetingSuggestionResponse(BaseModel):
    suggestions: List[MeetingSuggestion]


class MeetingConfirmationRequest(BaseModel):
    user_id: str | None = Field(default=None, min_length=1)
    start_time: datetime
    end_time: datetime
    title: Optional[str] = Field(None, max_length=200)

    @validator("end_time")
    def validate_meeting_range(cls, value: datetime, values: dict[str, datetime]) -> datetime:
        start = values.get("start_time")
        if start and value <= start:
            raise ValueError("end_time must be after start_time")
        return value

    @validator("title")
    def validate_title(cls, v):
        if v:
            return v.strip()
        return v


class GroupMeetingRead(BaseModel):
    id: int
    group_id: str
    scheduled_start: datetime
    scheduled_end: datetime
    suggested_by: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True
