"""Calendar and meetup detection endpoints."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_optional_user
from ..models.user import User
from ..schemas.calendar import (
    CalendarInviteRequest,
    CalendarInviteResponse,
    MeetupDetectionResponse,
)
from ..services.calendar_service import CalendarService

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.post("/detect-meetup", response_model=MeetupDetectionResponse)
def detect_meetup_in_message(
    message: str,
    db: Session = Depends(get_db),
    actor: User | None = Depends(get_optional_user),
) -> MeetupDetectionResponse:
    """
    Analyze a message to detect if it contains a meetup proposal.
    Returns extracted location and time if found.
    """
    is_meetup = CalendarService.detect_meetup_proposal(message)
    
    if not is_meetup:
        return MeetupDetectionResponse(
            is_meetup=False,
            confidence=0.0,
            suggestion=None,
        )
    
    # Extract details
    location = CalendarService.extract_location_from_message(message)
    proposed_time = CalendarService.extract_time_from_message(message)
    
    # Calculate confidence
    confidence = 0.5  # Base confidence for keyword match
    if location:
        confidence += 0.3
    if proposed_time:
        confidence += 0.2
    
    # Generate suggestion
    suggestion = "Meetup detected! "
    if proposed_time and location:
        time_str = proposed_time.strftime("%A at %I:%M %p")
        suggestion += f"Would you like to add '{location}' on {time_str} to your calendar?"
    elif location:
        suggestion += f"Would you like to schedule a meetup at '{location}'?"
    elif proposed_time:
        time_str = proposed_time.strftime("%A at %I:%M %p")
        suggestion += f"Would you like to schedule this for {time_str}?"
    else:
        suggestion += "Would you like to add this to your calendar?"
    
    return MeetupDetectionResponse(
        is_meetup=True,
        location=location,
        proposed_time=proposed_time,
        confidence=min(1.0, confidence),
        suggestion=suggestion,
    )


@router.post("/generate-invite", response_model=CalendarInviteResponse)
def generate_calendar_invite(
    request: CalendarInviteRequest,
    db: Session = Depends(get_db),
    actor: User | None = Depends(get_optional_user),
) -> CalendarInviteResponse:
    """
    Generate a downloadable calendar invite (.ics file).
    """
    # Calculate end time
    end_time = request.start_time + timedelta(minutes=request.duration_minutes)
    
    # Generate title
    title = request.title or f"Meetup with {request.partner_name}"
    
    # Generate description
    description_parts = [f"Meeting with {request.partner_name}"]
    if request.notes:
        description_parts.append(request.notes)
    if actor:
        description_parts.append(f"Organized by {actor.display_name or actor.email}")
    description = "\\n\\n".join(description_parts)
    
    # Generate .ics content
    ics_content = CalendarService.generate_ics(
        title=title,
        description=description,
        location=request.location,
        start_time=request.start_time,
        end_time=end_time,
        attendee_email=request.partner_email,
        organizer_email=actor.email if actor else None,
    )
    
    # Generate filename
    safe_partner_name = "".join(c for c in request.partner_name if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_partner_name = safe_partner_name.replace(' ', '_')
    date_str = request.start_time.strftime("%Y%m%d")
    filename = f"meetup_{safe_partner_name}_{date_str}.ics"
    
    # Generate summary
    time_str = request.start_time.strftime("%A, %B %d at %I:%M %p")
    summary = f"{title} at {request.location} on {time_str}"
    
    return CalendarInviteResponse(
        ics_content=ics_content,
        filename=filename,
        event_summary=summary,
    )


@router.post("/download-invite")
def download_calendar_invite(
    request: CalendarInviteRequest,
    db: Session = Depends(get_db),
    actor: User | None = Depends(get_optional_user),
):
    """
    Generate and return a calendar invite file for direct download.
    Returns the .ics file with proper content-type header.
    """
    # Generate the invite
    invite_response = generate_calendar_invite(request, db, actor)
    
    # Return as downloadable file
    return Response(
        content=invite_response.ics_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="{invite_response.filename}"',
            "Content-Type": "text/calendar; charset=utf-8",
        },
    )
