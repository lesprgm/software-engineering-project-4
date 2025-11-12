from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Availability, GroupMeeting
from ..schemas.scheduling import MeetingPreferences, MeetingSuggestion
from .groups import GroupService

settings = get_settings()


@dataclass
class AvailabilityWindow:
    start: datetime
    end: datetime
    user_id: str


def _resolve_timezone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _normalize_timestamp(moment: datetime, target_tz: ZoneInfo) -> datetime:
    if moment.tzinfo is None:
        return moment.replace(tzinfo=target_tz)
    return moment.astimezone(target_tz)


def _ensure_utc(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        return moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)


class AvailabilityService:
    @staticmethod
    def add_window(
        db: Session,
        *,
        group_id: str,
        user_id: str,
        start_time: datetime,
        end_time: datetime,
        timezone_name: str,
    ) -> Availability:
        GroupService._assert_membership(db, group_id=group_id, user_id=user_id)

        target_tz = _resolve_timezone(timezone_name)
        start_time = _normalize_timestamp(start_time, target_tz)
        end_time = _normalize_timestamp(end_time, target_tz)

        if end_time <= start_time:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid availability range")

        start_utc = start_time.astimezone(timezone.utc)
        end_utc = end_time.astimezone(timezone.utc)

        overlapping = (
            db.execute(
                select(Availability)
                .where(Availability.group_id == group_id, Availability.user_id == user_id)
                .where(Availability.end_time > start_utc)
                .where(Availability.start_time < end_utc)
            )
            .scalars()
            .all()
        )
        for window in overlapping:
            db.delete(window)

        record = Availability(
            group_id=group_id,
            user_id=user_id,
            start_time=start_utc,
            end_time=end_utc,
            timezone=timezone_name,
        )
        db.add(record)
        db.flush()
        db.refresh(record)
        return record

    @staticmethod
    def list_group_windows(db: Session, *, group_id: str) -> List[Availability]:
        return (
            db.execute(select(Availability).where(Availability.group_id == group_id))
            .scalars()
            .all()
        )


class SchedulingService:
    @staticmethod
    def default_preferences() -> MeetingPreferences:
        return MeetingPreferences(
            duration_minutes=settings.default_meeting_duration_minutes,
            window_days=settings.meeting_window_days,
            limit=5,
        )

    @staticmethod
    def suggest_meetings(
        db: Session,
        *,
        group_id: str,
        preferences: MeetingPreferences | None = None,
    ) -> List[MeetingSuggestion]:
        prefs = preferences or SchedulingService.default_preferences()

        member_ids = GroupService.get_member_ids(db, group_id)
        if not member_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group has no members")

        raw_availabilities = (
            db.execute(select(Availability).where(Availability.group_id == group_id))
            .scalars()
            .all()
        )
        if not raw_availabilities:
            return []

        now_utc = datetime.now(timezone.utc)
        earliest_start = min(_ensure_utc(avail.start_time) for avail in raw_availabilities)
        window_start = min(now_utc, earliest_start)
        window_end = window_start + timedelta(days=prefs.window_days)

        normalized_entries = []
        for avail in raw_availabilities:
            start = _ensure_utc(avail.start_time)
            end = _ensure_utc(avail.end_time)
            if start < window_end and end > window_start:
                normalized_entries.append((avail.user_id, start, end))

        if not normalized_entries:
            return []

        windows = []
        for user_id, start, end in normalized_entries:
            clamped_start = max(start, window_start)
            clamped_end = min(end, window_end)
            if clamped_end <= clamped_start:
                continue
            windows.append(
                AvailabilityWindow(
                    start=clamped_start,
                    end=clamped_end,
                    user_id=user_id,
                )
            )

        if not windows:
            return []

        duration = timedelta(minutes=prefs.duration_minutes)
        suggestions = SchedulingService._collect_conflict_free_windows(
            windows, member_ids, duration, prefs.limit
        )

        if len(suggestions) < prefs.limit:
            fallback = SchedulingService._collect_best_effort_windows(
                windows, member_ids, duration, prefs.limit - len(suggestions)
            )
            suggestions.extend(fallback)
        return suggestions[: prefs.limit]

    @staticmethod
    def confirm_meeting(
        db: Session,
        *,
        group_id: str,
        scheduled_start: datetime,
        scheduled_end: datetime,
        suggested_by: str | None,
        note: str | None,
    ) -> GroupMeeting:
        if scheduled_end <= scheduled_start:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid meeting range")

        start_dt = _normalize_timestamp(scheduled_start, timezone.utc)
        end_dt = _normalize_timestamp(scheduled_end, timezone.utc)

        record = GroupMeeting(
            group_id=group_id,
            scheduled_start=start_dt,
            scheduled_end=end_dt,
            suggested_by=suggested_by,
            note=note,
        )
        db.add(record)
        db.flush()
        db.refresh(record)
        return record

    @staticmethod
    def _collect_conflict_free_windows(
        windows: Sequence[AvailabilityWindow],
        member_ids: Sequence[str],
        duration: timedelta,
        limit: int,
    ) -> List[MeetingSuggestion]:
        events: list[tuple[datetime, int]] = []
        for window in windows:
            events.append((window.start, 1))
            events.append((window.end, -1))
        events.sort(key=lambda item: (item[0], -item[1]))

        active_count = 0
        interval_start: datetime | None = None
        full_slots: List[MeetingSuggestion] = []

        member_set = set(member_ids)
        availability_lookup = SchedulingService._availability_lookup(windows)

        for timestamp, delta in events:
            prev_count = active_count
            active_count += delta
            if prev_count < len(member_ids) and active_count == len(member_ids):
                interval_start = timestamp
            elif prev_count == len(member_ids) and active_count < len(member_ids) and interval_start:
                interval_end = timestamp
                full_slots.extend(
                    SchedulingService._split_interval(
                        interval_start,
                        interval_end,
                        duration,
                        member_set,
                        availability_lookup,
                        limit - len(full_slots),
                    )
                )
                interval_start = None
            if len(full_slots) >= limit:
                break
        return full_slots[:limit]

    @staticmethod
    def _collect_best_effort_windows(
        windows: Sequence[AvailabilityWindow],
        member_ids: Sequence[str],
        duration: timedelta,
        needed: int,
    ) -> List[MeetingSuggestion]:
        member_set = set(member_ids)
        availability_lookup = SchedulingService._availability_lookup(windows)
        scored_slots: list[tuple[float, MeetingSuggestion]] = []
        for window in windows:
            slot_start = window.start
            slot_end = min(window.end, window.start + duration)
            if slot_end - slot_start < duration:
                continue
            participants = SchedulingService._participants_for_slot(
                slot_start, slot_end, member_set, availability_lookup
            )
            if len(participants) == len(member_set):
                continue  # already captured as conflict-free
            score = len(participants) / len(member_set)
            conflicts = sorted(member_set - set(participants))
            suggestion = MeetingSuggestion(
                start_time=slot_start,
                end_time=slot_end,
                participant_ids=participants,
                conflicts=conflicts,
            )
            scored_slots.append((score, suggestion))
        scored_slots.sort(key=lambda item: item[0], reverse=True)
        return [suggestion for _, suggestion in scored_slots[:needed]]

    @staticmethod
    def _availability_lookup(
        windows: Sequence[AvailabilityWindow],
    ) -> dict[str, list[tuple[datetime, datetime]]]:
        lookup: dict[str, list[tuple[datetime, datetime]]] = defaultdict(list)
        for window in windows:
            lookup[window.user_id].append((window.start, window.end))
        for entries in lookup.values():
            entries.sort(key=lambda item: item[0])
        return lookup

    @staticmethod
    def _split_interval(
        start: datetime,
        end: datetime,
        duration: timedelta,
        member_set: set[str],
        availability_lookup: dict[str, list[tuple[datetime, datetime]]],
        remaining: int,
    ) -> List[MeetingSuggestion]:
        results: List[MeetingSuggestion] = []
        current = start
        while current + duration <= end and len(results) < remaining:
            slot_start = current
            slot_end = current + duration
            participants = SchedulingService._participants_for_slot(
                slot_start, slot_end, member_set, availability_lookup
            )
            if len(participants) == len(member_set):
                results.append(
                    MeetingSuggestion(
                        start_time=slot_start,
                        end_time=slot_end,
                        participant_ids=participants,
                        conflicts=[],
                    )
                )
            current += duration
        return results

    @staticmethod
    def _participants_for_slot(
        slot_start: datetime,
        slot_end: datetime,
        member_set: set[str],
        availability_lookup: dict[str, list[tuple[datetime, datetime]]],
    ) -> List[str]:
        participants: List[str] = []
        for member in member_set:
            windows = availability_lookup.get(member, [])
            for start, end in windows:
                if start <= slot_start and end >= slot_end:
                    participants.append(member)
                    break
        return participants
