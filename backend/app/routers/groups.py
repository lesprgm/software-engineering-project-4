from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings

router = APIRouter(
    prefix="/groups",
    tags=["groups"],
)


@router.get("/")
def list_groups():
    return {"message": "Groups endpoint working!"}


@router.post("/{group_id}/meeting-suggestions")
def meeting_suggestions(group_id: str, db: Session = Depends(get_db)):
    """Return meeting suggestion defaults (minimal implementation used by tests)."""
    settings = get_settings()
    prefs = {
        "duration_minutes": settings.default_meeting_duration_minutes,
        "window_days": settings.meeting_window_days,
        "limit": 5,
    }
    return {"preferences": prefs}
