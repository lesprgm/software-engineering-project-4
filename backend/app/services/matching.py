from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, List
import os
from dotenv import load_dotenv
import google.generativeai as genai
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..models import Availability, Group, GroupMembership, User
from ..schemas.group import GroupMatchCandidate

import math
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Load environment variables and configure Gemini (Google Generative AI)
load_dotenv()
_GENAI_API_KEY = os.getenv("GENAI_API_KEY")
_GENAI_MODEL = os.getenv("GENAI_MODEL", "gemini-pro")
if _GENAI_API_KEY:
    genai.configure(api_key=_GENAI_API_KEY)
    model = genai.GenerativeModel(_GENAI_MODEL)
else:
    model = None


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
        others = (
            db.execute(
                select(Group)
                .options(joinedload(Group.members))
                .where(Group.id != group_id)
            )
            .unique()
            .scalars()
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
        def _ensure_utc(dt):
            if dt is None:
                return dt
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)

        availability_windows = cls._merge_windows(
            [
                (max(_ensure_utc(row.start_time), window_start), min(_ensure_utc(row.end_time), window_end))
                (
                    max(cls._ensure_utc(row.start_time), window_start),
                    min(cls._ensure_utc(row.end_time), window_end),
                )
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

    @staticmethod
    def _ensure_utc(moment: datetime) -> datetime:
        if moment.tzinfo is None:
            return moment.replace(tzinfo=timezone.utc)
        return moment.astimezone(timezone.utc)

@dataclass
class UserProfile:
    id: int
    name: str
    interests: List[str]
    bio: str



class UserMatchingService:

    @classmethod
    def generate_user_matches(cls, db: Session, user_id:int, limit: int = 10):
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            return []
        
        candidates = db.query(User).filter(User.id != user_id).all()
        user_profile = cls._build_user_profile(user)
        matches = []

        for candidate in candidates:
            candidate_profile = cls._build_user_profile(candidate)
            score = cls._calculate_similarity(user_profile, candidate_profile)
            matches.append({
                "user_id": candidate.id,
                "name": candidate.display_name,
                "score": score
            })

            matches.sort(key=lambda x: x['score'], reverse=True)
            return matches[:limit]
    
    @staticmethod
    def _build_user_profile(user: User) -> UserProfile:
        return UserProfile(
            id=user.id,
            name=user.display_name,
            interests=user.interests.split(",") if isinstance(user.interests, str) else user.interests,
            bio=user.bio or ""  
        )
    
    @staticmethod
    def _calculate_similarity(user_a: UserProfile, user_b: UserProfile) -> float:
        interests_a = set(i.lower().strip() for i in user_a.interests)
        interests_b = set(i.lower().strip() for i in user_b.interests)

        common_interests = len(set(interests_a) & set(interests_b))
        total_interests = len(set(interests_a) | set(interests_b))
        interest_score = common_interests / total_interests if total_interests > 0 else 0

        # Use Gemini to analyze compatibility (fall back safely if not configured)
        ai_score = 0.0
        if model is not None:
            try:
                prompt = f"""
                Analyze the compatibility between two users based on their interests, bios, and overall profiles:
                
                User A:
                - Interests: {', '.join(interests_a)}
                - Bio: {user_a.bio}
                
                User B:
                - Interests: {', '.join(interests_b)}
                - Bio: {user_b.bio}
                
                Rate their compatibility on a scale of 0 to 1, where 1 is highest compatibility.
                Consider factors like:
                - Interest overlap and complementarity
                - Common themes and values expressed in their bios
                - Writing style and personality similarities in bios
                - Potential for meaningful interaction based on both interests and bio content
                - Shared experiences or backgrounds implied in their bios
                - Overall profile harmony
                
                Return only the numeric score between 0 and 1.
                """

                response = model.generate_content(prompt)
                # response shape varies between client versions; try common fields
                text = ""
                if hasattr(response, "text") and response.text:
                    text = response.text
                elif hasattr(response, "candidates") and response.candidates:
                    first = response.candidates[0]
                    if hasattr(first, "content"):
                        text = first.content
                    elif isinstance(first, dict) and "content" in first:
                        text = first["content"]

                if text:
                    try:
                        ai_score = float(text.strip())
                    except Exception:
                        ai_score = 0.0
            except Exception:
                ai_score = 0.0

        final_score = (interest_score + ai_score) / 2
        return min(max(final_score, 0), 1)

