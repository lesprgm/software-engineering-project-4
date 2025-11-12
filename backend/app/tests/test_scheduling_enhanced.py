"""
Enhanced test suite for scheduling functionality with edge cases and stress tests.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models import Availability, Group, GroupMembership, User
from app.services.scheduling import AvailabilityService, SchedulingService
from app.schemas.scheduling import MeetingPreferences


def _create_group_with_members(session, group_name: str, member_count: int) -> tuple[str, list[str]]:
    """Helper to create a group with specified number of members."""
    group = Group(name=group_name, description=f"Test group: {group_name}", invite_code=f"code-{group_name}")
    session.add(group)
    session.flush()
    
    user_ids = []
    for idx in range(member_count):
        user_id = f"user-{group.id}-{idx}"
        user = User(id=user_id, email=f"user{idx}@{group_name}.com", display_name=f"User {idx}")
        session.add(user)
        membership = GroupMembership(
            group_id=group.id,
            user_id=user_id,
            role="owner" if idx == 0 else "member"
        )
        session.add(membership)
        user_ids.append(user_id)
    
    session.commit()
    return group.id, user_ids


class TestAvailabilityManagement:
    """Tests for availability window management."""
    
    def test_add_multiple_non_overlapping_windows(self, db_session):
        """Users can add multiple non-overlapping availability windows."""
        group_id, user_ids = _create_group_with_members(db_session, "MultiWindow", 1)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        user_id = user_ids[0]
        
        # Add three separate windows
        windows = []
        for i in range(3):
            window = AvailabilityService.add_window(
                db_session,
                group_id=group_id,
                user_id=user_id,
                start_time=now + timedelta(hours=i * 3),
                end_time=now + timedelta(hours=i * 3 + 1),
                timezone_name="UTC",
            )
            windows.append(window)
        
        db_session.commit()
        
        # Verify all windows exist
        all_windows = AvailabilityService.list_group_windows(db_session, group_id=group_id)
        assert len(all_windows) == 3
        
        # Verify they're in chronological order
        sorted_windows = sorted(all_windows, key=lambda w: w.start_time)
        for i in range(2):
            assert sorted_windows[i].end_time <= sorted_windows[i + 1].start_time
    
    def test_partial_overlap_replaces_old_window(self, db_session):
        """Partially overlapping windows replace old windows."""
        group_id, user_ids = _create_group_with_members(db_session, "PartialOverlap", 1)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        # Add first window: 10:00 - 12:00
        first = AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[0],
            start_time=now + timedelta(hours=10),
            end_time=now + timedelta(hours=12),
            timezone_name="UTC",
        )
        
        # Add overlapping window: 11:00 - 13:00 (overlaps by 1 hour)
        second = AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[0],
            start_time=now + timedelta(hours=11),
            end_time=now + timedelta(hours=13),
            timezone_name="UTC",
        )
        
        db_session.commit()
        
        windows = AvailabilityService.list_group_windows(db_session, group_id=group_id)
        assert len(windows) == 1, "Overlapping window should replace old one"
        assert windows[0].id == second.id
    
    def test_timezone_handling_different_zones(self, db_session):
        """Availability windows correctly handle different timezones."""
        group_id, user_ids = _create_group_with_members(db_session, "Timezone", 2)
        
        # User 1 in EST (UTC-5)
        est_time = datetime(2025, 11, 10, 14, 0, 0)  # 2:00 PM EST
        AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[0],
            start_time=est_time,
            end_time=est_time + timedelta(hours=2),
            timezone_name="America/New_York",
        )
        
        # User 2 in PST (UTC-8)
        pst_time = datetime(2025, 11, 10, 11, 0, 0)  # 11:00 AM PST (same as 2:00 PM EST)
        AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[1],
            start_time=pst_time,
            end_time=pst_time + timedelta(hours=2),
            timezone_name="America/Los_Angeles",
        )
        
        db_session.commit()
        
        # Both should have overlapping time when normalized to UTC
        preferences = MeetingPreferences(duration_minutes=60, window_days=7, limit=5)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) > 0, "Should find overlapping time across timezones"
        assert not suggestions[0].conflicts, "Times should overlap without conflicts"


class TestMeetingSuggestions:
    """Tests for meeting suggestion algorithm."""
    
    def test_large_group_finds_common_time(self, db_session):
        """Algorithm efficiently finds common time for large groups."""
        group_id, user_ids = _create_group_with_members(db_session, "LargeGroup", 10)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        # All users available at same time
        common_start = now + timedelta(hours=10)
        common_end = now + timedelta(hours=12)
        
        for user_id in user_ids:
            AvailabilityService.add_window(
                db_session,
                group_id=group_id,
                user_id=user_id,
                start_time=common_start,
                end_time=common_end,
                timezone_name="UTC",
            )
        
        db_session.commit()
        
        preferences = MeetingPreferences(duration_minutes=60, window_days=1, limit=3)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) > 0
        assert len(suggestions[0].participant_ids) == 10
        assert not suggestions[0].conflicts
    
    def test_no_availability_returns_empty(self, db_session):
        """Returns empty list when no availability exists."""
        group_id, _ = _create_group_with_members(db_session, "NoAvail", 3)
        
        preferences = MeetingPreferences(duration_minutes=60, window_days=7, limit=5)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert suggestions == []
    
    def test_minimal_overlap_finds_slot(self, db_session):
        """Finds meeting slots even with minimal overlap."""
        group_id, user_ids = _create_group_with_members(db_session, "MinOverlap", 3)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        # User 1: 10:00 - 11:30
        AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[0],
            start_time=now + timedelta(hours=10),
            end_time=now + timedelta(hours=11, minutes=30),
            timezone_name="UTC",
        )
        
        # User 2: 10:30 - 12:00
        AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[1],
            start_time=now + timedelta(hours=10, minutes=30),
            end_time=now + timedelta(hours=12),
            timezone_name="UTC",
        )
        
        # User 3: 11:00 - 13:00
        AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[2],
            start_time=now + timedelta(hours=11),
            end_time=now + timedelta(hours=13),
            timezone_name="UTC",
        )
        
        db_session.commit()
        
        # All three overlap between 11:00 - 11:30 (30 minutes)
        preferences = MeetingPreferences(duration_minutes=30, window_days=1, limit=5)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) > 0
        first = suggestions[0]
        assert len(first.participant_ids) == 3
        assert not first.conflicts
    
    def test_meeting_duration_variations(self, db_session):
        """Tests various meeting duration requirements."""
        group_id, user_ids = _create_group_with_members(db_session, "Durations", 2)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        # Both available for 3 hours
        for user_id in user_ids:
            AvailabilityService.add_window(
                db_session,
                group_id=group_id,
                user_id=user_id,
                start_time=now + timedelta(hours=10),
                end_time=now + timedelta(hours=13),
                timezone_name="UTC",
            )
        
        db_session.commit()
        
        # Test different durations
        for duration in [15, 30, 60, 90, 120]:
            preferences = MeetingPreferences(duration_minutes=duration, window_days=1, limit=1)
            suggestions = SchedulingService.suggest_meetings(
                db_session,
                group_id=group_id,
                preferences=preferences,
            )
            
            assert len(suggestions) > 0, f"Should find slot for {duration} minute meeting"
            assert suggestions[0].end_time - suggestions[0].start_time == timedelta(minutes=duration)
    
    def test_window_days_parameter(self, db_session):
        """window_days parameter correctly limits search range."""
        group_id, user_ids = _create_group_with_members(db_session, "WindowDays", 2)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        # Availability 20 days in the future
        far_future = now + timedelta(days=20)
        for user_id in user_ids:
            AvailabilityService.add_window(
                db_session,
                group_id=group_id,
                user_id=user_id,
                start_time=far_future,
                end_time=far_future + timedelta(hours=2),
                timezone_name="UTC",
            )
        
        db_session.commit()
        
        # Search only next 14 days - should find nothing
        preferences = MeetingPreferences(duration_minutes=60, window_days=14, limit=5)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) == 0, "Should not find slots outside window_days range"
        
        # Expand search to 30 days - should find it
        preferences.window_days = 30
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) > 0, "Should find slots within extended range"


class TestBestEffortMatching:
    """Tests for best-effort matching when perfect overlap isn't available."""
    
    def test_returns_partial_matches_sorted_by_coverage(self, db_session):
        """Best-effort returns partial matches sorted by participant count."""
        group_id, user_ids = _create_group_with_members(db_session, "BestEffort", 4)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        # Users 0, 1, 2 overlap at 10:00-11:00
        for user_id in user_ids[:3]:
            AvailabilityService.add_window(
                db_session,
                group_id=group_id,
                user_id=user_id,
                start_time=now + timedelta(hours=10),
                end_time=now + timedelta(hours=11),
                timezone_name="UTC",
            )
        
        # Only users 0, 1 overlap at 14:00-15:00
        for user_id in user_ids[:2]:
            AvailabilityService.add_window(
                db_session,
                group_id=group_id,
                user_id=user_id,
                start_time=now + timedelta(hours=14),
                end_time=now + timedelta(hours=15),
                timezone_name="UTC",
            )
        
        # User 3 only available at 16:00-17:00
        AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[3],
            start_time=now + timedelta(hours=16),
            end_time=now + timedelta(hours=17),
            timezone_name="UTC",
        )
        
        db_session.commit()
        
        preferences = MeetingPreferences(duration_minutes=60, window_days=1, limit=5)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) > 0
        
        # First suggestion should have most participants (3)
        best = suggestions[0]
        assert len(best.participant_ids) == 3
        assert len(best.conflicts) == 1
        assert user_ids[3] in best.conflicts


class TestEdgeCases:
    """Edge cases and boundary conditions."""
    
    def test_single_member_group(self, db_session):
        """Single-member group can create availability and get suggestions."""
        group_id, user_ids = _create_group_with_members(db_session, "Solo", 1)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        AvailabilityService.add_window(
            db_session,
            group_id=group_id,
            user_id=user_ids[0],
            start_time=now + timedelta(hours=10),
            end_time=now + timedelta(hours=12),
            timezone_name="UTC",
        )
        
        db_session.commit()
        
        preferences = MeetingPreferences(duration_minutes=60, window_days=1, limit=5)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) > 0
        assert len(suggestions[0].participant_ids) == 1
    
    def test_very_short_meeting_duration(self, db_session):
        """Handles minimum meeting duration (15 minutes)."""
        group_id, user_ids = _create_group_with_members(db_session, "ShortMeet", 2)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        for user_id in user_ids:
            AvailabilityService.add_window(
                db_session,
                group_id=group_id,
                user_id=user_id,
                start_time=now + timedelta(hours=10),
                end_time=now + timedelta(hours=10, minutes=20),
                timezone_name="UTC",
            )
        
        db_session.commit()
        
        preferences = MeetingPreferences(duration_minutes=15, window_days=1, limit=5)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) > 0
        assert suggestions[0].end_time - suggestions[0].start_time == timedelta(minutes=15)
    
    def test_availability_exactly_at_meeting_duration(self, db_session):
        """Handles case where availability exactly matches meeting duration."""
        group_id, user_ids = _create_group_with_members(db_session, "Exact", 2)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        # Exactly 1 hour available
        for user_id in user_ids:
            AvailabilityService.add_window(
                db_session,
                group_id=group_id,
                user_id=user_id,
                start_time=now + timedelta(hours=10),
                end_time=now + timedelta(hours=11),
                timezone_name="UTC",
            )
        
        db_session.commit()
        
        preferences = MeetingPreferences(duration_minutes=60, window_days=1, limit=5)
        suggestions = SchedulingService.suggest_meetings(
            db_session,
            group_id=group_id,
            preferences=preferences,
        )
        
        assert len(suggestions) == 1
        assert suggestions[0].start_time == now + timedelta(hours=10)
        assert suggestions[0].end_time == now + timedelta(hours=11)
    
    def test_empty_group_raises_error(self, db_session):
        """Empty group (no members) raises appropriate error."""
        group = Group(name="EmptyGroup", description="", invite_code="empty-123")
        db_session.add(group)
        db_session.commit()
        
        preferences = MeetingPreferences(duration_minutes=60, window_days=7, limit=5)
        
        with pytest.raises(HTTPException) as exc:
            SchedulingService.suggest_meetings(
                db_session,
                group_id=group.id,
                preferences=preferences,
            )
        
        assert exc.value.status_code == 404
        assert "no members" in exc.value.detail.lower()


class TestMeetingConfirmation:
    """Tests for meeting confirmation functionality."""
    
    def test_confirm_with_all_fields(self, db_session):
        """Meeting confirmation stores all provided fields."""
        group_id, user_ids = _create_group_with_members(db_session, "Confirm", 2)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        meeting = SchedulingService.confirm_meeting(
            db_session,
            group_id=group_id,
            scheduled_start=now + timedelta(hours=10),
            scheduled_end=now + timedelta(hours=11),
            suggested_by=user_ids[0],
            note="Team standup - bring updates",
        )
        
        db_session.commit()
        
        assert meeting.group_id == group_id
        assert meeting.suggested_by == user_ids[0]
        assert meeting.note == "Team standup - bring updates"
        assert meeting.scheduled_end - meeting.scheduled_start == timedelta(hours=1)
        assert meeting.created_at is not None
    
    def test_confirm_minimal_fields(self, db_session):
        """Meeting confirmation works with only required fields."""
        group_id, _ = _create_group_with_members(db_session, "MinConfirm", 2)
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        meeting = SchedulingService.confirm_meeting(
            db_session,
            group_id=group_id,
            scheduled_start=now + timedelta(hours=10),
            scheduled_end=now + timedelta(hours=11),
            suggested_by=None,
            note=None,
        )
        
        db_session.commit()
        
        assert meeting.group_id == group_id
        assert meeting.suggested_by is None
        assert meeting.note is None
