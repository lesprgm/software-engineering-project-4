from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.group import (
    GroupCreate,
    GroupDetail,
    GroupMatchResponse,
    GroupMessageCreate,
    GroupMessagePage,
    GroupMessageRead,
    GroupRead,
    InviteLinkResponse,
    JoinGroupRequest,
)
from ..schemas.scheduling import (
    AvailabilityCreate,
    AvailabilityRead,
    GroupMeetingRead,
    MeetingConfirmationRequest,
    MeetingPreferences,
    MeetingSuggestionResponse,
)
from ..services.groups import GroupQueryService, GroupService
from ..services.matching import MatchingService
from ..services.scheduling import AvailabilityService, SchedulingService

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("/", response_model=GroupRead, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupCreate, db: Session = Depends(get_db)) -> GroupRead:
    group = GroupService.create_group(
        db,
        name=payload.name,
        description=payload.description,
        owner_id=payload.owner_id,
    )
    db.commit()
    return group


@router.get("/", response_model=list[GroupRead])
def list_groups(db: Session = Depends(get_db)) -> list[GroupRead]:
    groups = GroupQueryService.list_groups(db)
    return list(groups)


@router.get("/{group_id}", response_model=GroupDetail)
def retrieve_group(group_id: str, db: Session = Depends(get_db)) -> GroupDetail:
    group = GroupService.get_group(db, group_id)
    return group


@router.post("/{group_id}/join", response_model=GroupDetail)
def join_group(
    group_id: str,
    payload: JoinGroupRequest,
    db: Session = Depends(get_db),
) -> GroupDetail:
    group = GroupService.join_group(
        db,
        group_id=group_id,
        user_id=payload.user_id,
        invite_code=payload.invite_code,
    )
    db.commit()
    return GroupService.get_group(db, group.id)


@router.get("/{group_id}/invite", response_model=InviteLinkResponse)
def get_invite_link(group_id: str, db: Session = Depends(get_db)) -> InviteLinkResponse:
    group = GroupService.get_group(db, group_id)
    url = GroupService.get_invite_link(group)
    return InviteLinkResponse(group_id=group.id, invite_code=group.invite_code, shareable_url=url)


@router.post(
    "/{group_id}/messages",
    response_model=GroupMessageRead,
    status_code=status.HTTP_201_CREATED,
)
def post_message(
    group_id: str,
    payload: GroupMessageCreate,
    db: Session = Depends(get_db),
) -> GroupMessageRead:
    message = GroupService.post_message(
        db,
        group_id=group_id,
        user_id=payload.user_id,
        content=payload.content,
    )
    db.commit()
    return message


@router.get("/{group_id}/messages", response_model=GroupMessagePage)
def list_messages(
    group_id: str,
    *,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> GroupMessagePage:
    page = GroupService.list_messages(db, group_id=group_id, limit=limit, offset=offset)
    return GroupMessagePage(messages=page.messages, total=page.total)


@router.post(
    "/{group_id}/availability",
    response_model=AvailabilityRead,
    status_code=status.HTTP_201_CREATED,
)
def add_availability(
    group_id: str,
    payload: AvailabilityCreate,
    db: Session = Depends(get_db),
) -> AvailabilityRead:
    record = AvailabilityService.add_window(
        db,
        group_id=group_id,
        user_id=payload.user_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        timezone_name=payload.timezone,
    )
    db.commit()
    return record


@router.get("/{group_id}/availability", response_model=list[AvailabilityRead])
def list_availability(group_id: str, db: Session = Depends(get_db)) -> list[AvailabilityRead]:
    return AvailabilityService.list_group_windows(db, group_id=group_id)


@router.post("/{group_id}/meeting-suggestions", response_model=MeetingSuggestionResponse)
@router.post(
    "/{group_id}/suggestions",
    response_model=MeetingSuggestionResponse,
    include_in_schema=False,
)
def suggest_meetings(
    group_id: str,
    preferences: MeetingPreferences | None = None,
    db: Session = Depends(get_db),
) -> MeetingSuggestionResponse:
    suggestions = SchedulingService.suggest_meetings(
        db,
        group_id=group_id,
        preferences=preferences,
    )
    return MeetingSuggestionResponse(suggestions=suggestions)


@router.post(
    "/{group_id}/meetings",
    response_model=GroupMeetingRead,
    status_code=status.HTTP_201_CREATED,
)
def confirm_meeting(
    group_id: str,
    payload: MeetingConfirmationRequest,
    db: Session = Depends(get_db),
) -> GroupMeetingRead:
    meeting = SchedulingService.confirm_meeting(
        db,
        group_id=group_id,
        scheduled_start=payload.start_time,
        scheduled_end=payload.end_time,
        suggested_by=payload.user_id,
        note=payload.title,
    )
    db.commit()
    return meeting


@router.get("/{group_id}/matches", response_model=GroupMatchResponse)
def generate_matches(
    group_id: str,
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> GroupMatchResponse:
    candidates = MatchingService.generate_group_matches(db, group_id=group_id, limit=limit)
    return GroupMatchResponse(candidates=candidates)
