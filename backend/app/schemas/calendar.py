"""Schemas for meetup detection and calendar generation."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class MeetupDetectionResponse(BaseModel):
    """Response when analyzing a message for meetup proposals."""
    is_meetup: bool = Field(description="Whether the message contains a meetup proposal")
    location: Optional[str] = Field(None, description="Extracted location")
    proposed_time: Optional[datetime] = Field(None, description="Extracted time (ISO format)")
    confidence: float = Field(description="Confidence score 0-1")
    suggestion: Optional[str] = Field(None, description="Suggestion for the user")


class CalendarInviteRequest(BaseModel):
    """Request to generate a calendar invite."""
    partner_name: str = Field(description="Name of the person you're meeting")
    partner_email: Optional[str] = Field(None, description="Email of the other person")
    location: str = Field(description="Where the meetup is happening")
    start_time: datetime = Field(description="When the meetup starts")
    duration_minutes: int = Field(60, description="How long the meetup will last")
    title: Optional[str] = Field(None, description="Custom title for the event")
    notes: Optional[str] = Field(None, description="Additional notes")


class CalendarInviteResponse(BaseModel):
    """Response containing the calendar invite."""
    ics_content: str = Field(description="iCalendar format content")
    filename: str = Field(description="Suggested filename for download")
    event_summary: str = Field(description="Human-readable summary")
