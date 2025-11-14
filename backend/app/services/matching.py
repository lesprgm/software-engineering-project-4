from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Sequence, Set

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..demo_personas import DemoPersonaRegistry
from ..models import Availability, Group, GroupMembership, User
from ..schemas.group import GroupMatchCandidate
from ..schemas.user import UserMatchCandidate


@dataclass
class GroupProfile:
    group: Group
    member_ids: List[str]
    availability_windows: List[tuple[datetime, datetime]]


@dataclass
class UserProfile:
    user: User
    interests: Set[str]
    traits: Set[str]
    availability_windows: List[tuple[datetime, datetime]]


class MatchingService:
    LOOKAHEAD_DAYS = 14

    # --------------------
    # Group matching
    # --------------------
    @classmethod
    def generate_group_matches(cls, db: Session, group_id: str, limit: int = 5) -> List[GroupMatchCandidate]:
        primary = cls._build_group_profile(db, group_id)
        if primary is None:
            return []

        candidates: list[GroupMatchCandidate] = []
        others: list[Group] = (
            db.execute(
                select(Group)
                .options(joinedload(Group.members))
                .where(Group.id != group_id)
            )
            .unique()
            .scalars()
            .all()
        )

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
            candidates.append(
                GroupMatchCandidate(
                    group_id=group.id,
                    group_name=group.name,
                    compatibility_score=float(score),
                    overlap_minutes=overlap_minutes,
                    size=len(profile.member_ids),
                )
            )

        candidates.sort(key=lambda candidate: candidate.compatibility_score, reverse=True)
        return candidates[:limit]

    @classmethod
    def _build_group_profile(cls, db: Session, group_id: str) -> GroupProfile | None:
        group = (
            db.execute(
                select(Group)
                .options(joinedload(Group.members).joinedload(GroupMembership.user))
                .where(Group.id == group_id)
            )
            .unique()
            .scalar_one_or_none()
        )
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
        availability_windows = cls._merge_windows(
            [
                (
                    max(cls._ensure_utc(row.start_time), window_start),
                    min(cls._ensure_utc(row.end_time), window_end),
                )
                for row in availability_rows
                if row.start_time and row.end_time
            ]
        )
        return GroupProfile(group=group, member_ids=member_ids, availability_windows=availability_windows)

    # --------------------
    # User matching
    # --------------------
    @classmethod
    def generate_user_matches(cls, db: Session, user_id: str, limit: int = 10) -> List[UserMatchCandidate]:
        primary_user = db.get(User, user_id)
        if primary_user is None:
            return []

        primary_profile = cls._build_user_profile(db, primary_user)
        candidates: list[UserMatchCandidate] = []
        
        # Query all other users and expire them from session to prevent detached instance errors
        other_users_result = db.execute(select(User).where(User.id != user_id)).scalars().all()
        # Convert to list to ensure objects are loaded before any session operations
        other_users: list[User] = list(other_users_result)

        for user in other_users:
            # Eagerly access all attributes to avoid lazy loading after session closes
            user_id_val = user.id
            display_name_val = user.display_name
            photos_val = user.photos if user.photos else None
            
            profile = cls._build_user_profile(db, user)
            score_data = cls._score_user_profiles(primary_profile, profile)
            overall = score_data["overall"]
            if overall <= 0:
                continue
            candidates.append(
                UserMatchCandidate(
                    user_id=user_id_val,
                    display_name=display_name_val,
                    compatibility_score=overall,
                    shared_interests=sorted(score_data["shared_interests"]),
                    schedule_score=score_data["schedule_score"],
                    personality_overlap=score_data["trait_score"],
                    photos=photos_val,
                )
            )

        # Remove demo personas from matching feed
        candidates.sort(key=lambda candidate: candidate.compatibility_score, reverse=True)
        return candidates[:limit]

    @classmethod
    def _build_user_profile(cls, db: Session, user: User) -> UserProfile:
        interests_raw = user.interests or []
        if isinstance(interests_raw, str):
            interests = {item.strip().lower() for item in interests_raw.split(",") if item.strip()}
        else:
            interests = {str(item).strip().lower() for item in interests_raw if str(item).strip()}

        traits = cls._extract_traits(user.bio or "")
        availability = cls._fetch_user_availability(db, user.id)
        return UserProfile(user=user, interests=interests, traits=traits, availability_windows=availability)

    @classmethod
    def _fetch_user_availability(cls, db: Session, user_id: str) -> List[tuple[datetime, datetime]]:
        window_start = datetime.now(timezone.utc)
        window_end = window_start + timedelta(days=cls.LOOKAHEAD_DAYS)
        rows = (
            db.execute(
                select(Availability)
                .where(Availability.user_id == user_id)
                .where(Availability.start_time < window_end)
                .where(Availability.end_time > window_start)
            )
            .scalars()
            .all()
        )
        return cls._merge_windows(
            [
                (
                    max(cls._ensure_utc(row.start_time), window_start),
                    min(cls._ensure_utc(row.end_time), window_end),
                )
                for row in rows
            ]
        )

    @classmethod
    def _score_user_profiles(cls, a: UserProfile, b: UserProfile) -> dict:
        shared_interests = a.interests & b.interests
        union_interests = a.interests | b.interests
        interest_score = len(shared_interests) / len(union_interests) if union_interests else 0.0

        overlap_minutes = cls._compute_overlap_minutes(a.availability_windows, b.availability_windows)
        schedule_score = min(overlap_minutes / 240, 1.0)  # normalized over 4 hours

        shared_traits = a.traits & b.traits
        union_traits = a.traits | b.traits
        trait_score = len(shared_traits) / len(union_traits) if union_traits else 0.0

        overall = (interest_score * 0.6) + (schedule_score * 0.25) + (trait_score * 0.15)
        return {
            "overall": round(overall, 3),
            "shared_interests": shared_interests,
            "schedule_score": round(schedule_score, 3),
            "trait_score": round(trait_score, 3),
        }

    # --------------------
    # Shared helpers
    # --------------------
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

    @staticmethod
    def _ensure_utc(moment: datetime) -> datetime:
        if moment.tzinfo is None:
            return moment.replace(tzinfo=timezone.utc)
        return moment.astimezone(timezone.utc)

    @staticmethod
    def _extract_traits(bio: str) -> Set[str]:
        normalized = bio.lower()
        keywords = {
            "introvert",
            "extrovert",
            "outdoorsy",
            "bookworm",
            "creative",
            "athletic",
            "foodie",
            "gamer",
            "leader",
            "planner",
            "spontaneous",
            "musician",
        }
        return {word for word in keywords if word in normalized}
