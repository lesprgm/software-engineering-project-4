from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models import Availability, Group, GroupMeeting, GroupMembership, User
from app.services.scheduling import AvailabilityService, SchedulingService
from app.schemas.scheduling import MeetingPreferences


def _seed_group(session, member_count: int = 2) -> tuple[str, list[str]]:
    group = Group(id="group-1", name="Weekend Warriors", description="", invite_code="invite-123")
    session.add(group)
    user_ids = []
    for idx in range(member_count):
        user_id = f"user-{idx}"
        user = User(id=user_id, email=f"user{idx}@example.com", display_name=f"User {idx}")
        session.add(user)
        membership = GroupMembership(group_id=group.id, user_id=user_id, role="member")
        session.add(membership)
        user_ids.append(user_id)
    session.commit()
    return group.id, user_ids


def test_conflict_free_suggestions(db_session):
    group_id, user_ids = _seed_group(db_session, member_count=2)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[0],
        start_time=now + timedelta(hours=2),
        end_time=now + timedelta(hours=5),
        timezone_name="UTC",
    )
    AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[1],
        start_time=now + timedelta(hours=3),
        end_time=now + timedelta(hours=6),
        timezone_name="UTC",
    )
    db_session.commit()

    preferences = MeetingPreferences(duration_minutes=60, window_days=1, limit=2)
    suggestions = SchedulingService.suggest_meetings(
        db_session,
        group_id=group_id,
        preferences=preferences,
    )

    assert suggestions, "Expected at least one suggestion"
    first = suggestions[0]
    assert not first.conflicts, "Conflict-free suggestion should not have conflicts listed"
    assert first.end_time - first.start_time == timedelta(minutes=60)


def test_best_effort_fallback(db_session):
    group_id, user_ids = _seed_group(db_session, member_count=3)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[0],
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=2),
        timezone_name="UTC",
    )
    AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[1],
        start_time=now + timedelta(hours=1, minutes=30),
        end_time=now + timedelta(hours=2, minutes=30),
        timezone_name="UTC",
    )
    AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[2],
        start_time=now + timedelta(hours=3),
        end_time=now + timedelta(hours=4),
        timezone_name="UTC",
    )
    db_session.commit()

    preferences = MeetingPreferences(duration_minutes=30, window_days=1, limit=3)
    suggestions = SchedulingService.suggest_meetings(
        db_session,
        group_id=group_id,
        preferences=preferences,
    )

    assert suggestions, "Fallback suggestions should be offered when no overlap is found"
    assert any(s.conflicts for s in suggestions), "At least one suggestion should mark conflicting members"


def test_add_window_overwrites_conflicting_slots(db_session):
    group_id, user_ids = _seed_group(db_session, member_count=1)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    first = AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[0],
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=2),
        timezone_name="UTC",
    )
    second = AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[0],
        start_time=now + timedelta(hours=1, minutes=30),
        end_time=now + timedelta(hours=2, minutes=30),
        timezone_name="UTC",
    )
    db_session.commit()

    windows = AvailabilityService.list_group_windows(db_session, group_id=group_id)
    assert len(windows) == 1
    record = windows[0]
    assert record.id == second.id
    assert record.start_time == second.start_time
    assert record.end_time == second.end_time
    assert record.start_time > first.start_time


def test_add_window_rejects_invalid_range(db_session):
    group_id, user_ids = _seed_group(db_session, member_count=1)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

    with pytest.raises(HTTPException) as exc:
        AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[0],
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=1),
            timezone_name="UTC",
        )
    assert exc.value.status_code == 400


def test_suggest_meetings_respects_limit(db_session):
    group_id, user_ids = _seed_group(db_session, member_count=2)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[0],
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=6),
        timezone_name="UTC",
    )
    AvailabilityService.add_window(
        db_session,
        group_id=group_id,
        user_id=user_ids[1],
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=6),
        timezone_name="UTC",
    )
    db_session.commit()

    preferences = MeetingPreferences(duration_minutes=30, window_days=1, limit=1)
    suggestions = SchedulingService.suggest_meetings(
        db_session,
        group_id=group_id,
        preferences=preferences,
    )

    assert len(suggestions) == 1
    suggestion = suggestions[0]
    assert suggestion.end_time - suggestion.start_time == timedelta(minutes=30)
    assert set(suggestion.participant_ids) == set(user_ids)


def test_confirm_meeting_rejects_invalid_range(db_session):
    group_id, _ = _seed_group(db_session, member_count=2)
    now = datetime.now(timezone.utc)

    with pytest.raises(HTTPException) as exc:
        SchedulingService.confirm_meeting(
            db_session,
            group_id=group_id,
            scheduled_start=now + timedelta(hours=2),
            scheduled_end=now + timedelta(hours=1),
            suggested_by=None,
            note=None,
        )
    assert exc.value.status_code == 400


def test_confirm_meeting_normalizes_naive_datetimes(db_session):
    group_id, _ = _seed_group(db_session, member_count=2)
    start = datetime.now(timezone.utc).replace(tzinfo=None, minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)

    meeting = SchedulingService.confirm_meeting(
        db_session,
        group_id=group_id,
        scheduled_start=start,
        scheduled_end=end,
        suggested_by=None,
        note="Prep meeting",
    )
    db_session.commit()

    stored = db_session.get(GroupMeeting, meeting.id)
    assert stored is not None
    expected_start = start.replace(tzinfo=timezone.utc)
    expected_end = end.replace(tzinfo=timezone.utc)

    stored_start = (
        stored.scheduled_start.replace(tzinfo=timezone.utc)
        if stored.scheduled_start.tzinfo is None
        else stored.scheduled_start.astimezone(timezone.utc)
    )
    stored_end = (
        stored.scheduled_end.replace(tzinfo=timezone.utc)
        if stored.scheduled_end.tzinfo is None
        else stored.scheduled_end.astimezone(timezone.utc)
    )

    assert stored_start == expected_start
    assert stored_end == expected_end
    assert stored_end - stored_start == timedelta(hours=1)
