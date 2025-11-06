from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, List

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..models import Availability, Group, GroupMembership
from ..schemas.group import GroupMatchCandidate


@dataclass
class GroupProfile:
    group: Group
    member_ids: List[str]
    availability_windows: List[tuple[datetime, datetime]]


class MatchingService:
    LOOKAHEAD_DAYS = 14

    @classmethod
    def generate_group_matches(cls, db: Session, group_id: str, limit: int = 5) -> List[GroupMatchCandidate]:
        primary = cls._build_group_profile(db, group_id)
        if primary is None:
            return []

        candidates: list[GroupMatchCandidate] = []
        others = db.execute(
            select(Group)
            .options(joinedload(Group.members))
            .where(Group.id != group_id)
        ).unique().scalars().all()

        for group in others:
            profile = cls._build_group_profile(db, group.id)
            if profile is None or not profile.availability_windows:
                continue
            overlap_minutes = cls._compute_overlap_minutes(primary.availability_windows, profile.availability_windows)
            if overlap_minutes <= 0:
                continue
            size_penalty = abs(len(primary.member_ids) - len(profile.member_ids)) * 15
            score = max(overlap_minutes - size_penalty, 0)
            if score <= 0:
                continue
            summary = (
                f"{len(profile.member_ids)} members • "
                f"~{overlap_minutes // 60} shared hours over next {cls.LOOKAHEAD_DAYS} days"
            )
            candidates.append(
                GroupMatchCandidate(
                    group_id=group.id,
                    compatibility_score=float(score),
                    summary=summary,
                )
            )

        candidates.sort(key=lambda candidate: candidate.compatibility_score, reverse=True)
        return candidates[:limit]

    @classmethod
    def _build_group_profile(cls, db: Session, group_id: str) -> GroupProfile | None:
        group = db.execute(
            select(Group)
            .options(joinedload(Group.members).joinedload(GroupMembership.user))
            .where(Group.id == group_id)
        ).unique().scalar_one_or_none()
        if group is None:
            return None
        member_ids = [membership.user_id for membership in group.members]
        if not member_ids:
            return GroupProfile(group=group, member_ids=[], availability_windows=[])

        window_start = datetime.now(timezone.utc)
        window_end = window_start + timedelta(days=cls.LOOKAHEAD_DAYS)
        availability_rows = (
            db.execute(
                select(Availability)
                .where(Availability.group_id == group_id)
                .where(Availability.start_time < window_end)
                .where(Availability.end_time > window_start)
            )
            .scalars()
            .all()
        )
        def _ensure_utc(dt):
            if dt is None:
                return dt
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)

        availability_windows = cls._merge_windows(
            [
                (max(_ensure_utc(row.start_time), window_start), min(_ensure_utc(row.end_time), window_end))
                for row in availability_rows
            ]
        )
        return GroupProfile(
            group=group,
            member_ids=member_ids,
            availability_windows=availability_windows,
        )

    @staticmethod
    def _merge_windows(windows: Iterable[tuple[datetime, datetime]]) -> List[tuple[datetime, datetime]]:
        sorted_windows = sorted((start, end) for start, end in windows if end > start)
        merged: List[tuple[datetime, datetime]] = []
        for start, end in sorted_windows:
            if not merged or start > merged[-1][1]:
                merged.append((start, end))
            else:
                prev_start, prev_end = merged[-1]
                merged[-1] = (prev_start, max(prev_end, end))
        return merged

    @staticmethod
    def _compute_overlap_minutes(
        windows_a: Iterable[tuple[datetime, datetime]],
        windows_b: Iterable[tuple[datetime, datetime]],
    ) -> int:
        total = 0
        windows_a = list(windows_a)
        windows_b = list(windows_b)
        idx_b = 0
        for start_a, end_a in windows_a:
            while idx_b < len(windows_b) and windows_b[idx_b][1] <= start_a:
                idx_b += 1
            j = idx_b
            while j < len(windows_b) and windows_b[j][0] < end_a:
                start = max(start_a, windows_b[j][0])
                end = min(end_a, windows_b[j][1])
                if end > start:
                    total += int((end - start).total_seconds() // 60)
                j += 1
        return total
