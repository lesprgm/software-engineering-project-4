from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Iterable, List

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..models import Group, GroupMembership, GroupMessage, User

settings = get_settings()


@dataclass
class PaginatedMessages:
    messages: List[GroupMessage]
    total: int


class GroupService:
    INVITE_CODE_BYTES = 6

    @classmethod
    def create_group(cls, db: Session, *, name: str, description: str | None, owner_id: str) -> Group:
        owner = db.get(User, owner_id)
        if owner is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner not found")

        invite_code = cls._generate_unique_invite(db)
        group = Group(name=name, description=description, invite_code=invite_code)
        db.add(group)
        db.flush()

        membership = GroupMembership(group_id=group.id, user_id=owner.id, role="owner")
        db.add(membership)
        db.flush()

        # Prefetch relationships for downstream serialization.
        db.refresh(group)
        return group

    @classmethod
    def join_group(cls, db: Session, *, group_id: str, user_id: str, invite_code: str) -> Group:
        group = (
            db.execute(select(Group).options(joinedload(Group.members)).where(Group.id == group_id))
            .unique()
            .scalar_one_or_none()
        )
        if group is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

        if group.invite_code != invite_code:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid invite code")

        if not db.get(User, user_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        exists = db.execute(
            select(GroupMembership).where(
                GroupMembership.group_id == group_id, GroupMembership.user_id == user_id
            )
        ).scalar_one_or_none()
        if exists:
            return group

        membership = GroupMembership(group_id=group_id, user_id=user_id, role="member")
        db.add(membership)
        db.flush()
        db.refresh(group)
        return group

    @classmethod
    def get_group(cls, db: Session, group_id: str) -> Group:
        group = (
            db.execute(
                select(Group)
                .options(
                    joinedload(Group.members).joinedload(GroupMembership.user),
                    joinedload(Group.availabilities),
                )
                .where(Group.id == group_id)
            )
            .unique()
            .scalar_one_or_none()
        )
        if group is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        return group

    @classmethod
    def get_invite_link(cls, group: Group) -> str:
        base = "https://example.com/join"
        return f"{base}/{group.invite_code}"

    @classmethod
    def post_message(cls, db: Session, *, group_id: str, user_id: str, content: str) -> GroupMessage:
        cls._assert_membership(db, group_id=group_id, user_id=user_id)
        message = GroupMessage(group_id=group_id, user_id=user_id, content=content)
        db.add(message)
        db.flush()
        db.refresh(message)
        return message

    @classmethod
    def list_messages(
        cls, db: Session, *, group_id: str, limit: int = 50, offset: int = 0
    ) -> PaginatedMessages:
        total = db.execute(
            select(func.count(GroupMessage.id)).where(GroupMessage.group_id == group_id)
        ).scalar_one()
        messages = (
            db.execute(
                select(GroupMessage)
                .where(GroupMessage.group_id == group_id)
                .order_by(GroupMessage.created_at.asc())
                .limit(limit)
                .offset(offset)
            )
            .scalars()
            .all()
        )
        return PaginatedMessages(messages=messages, total=total)

    @classmethod
    def get_member_ids(cls, db: Session, group_id: str) -> List[str]:
        membership = db.execute(
            select(GroupMembership.user_id).where(GroupMembership.group_id == group_id)
        ).scalars()
        members = membership.all()
        if not members:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group has no members")
        return members

    @classmethod
    def _generate_unique_invite(cls, db: Session) -> str:
        while True:
            candidate = secrets.token_urlsafe(cls.INVITE_CODE_BYTES)
            exists = db.execute(select(Group).where(Group.invite_code == candidate)).scalar_one_or_none()
            if not exists:
                return candidate

    @classmethod
    def _assert_membership(cls, db: Session, *, group_id: str, user_id: str) -> None:
        membership = db.execute(
            select(GroupMembership).where(
                GroupMembership.group_id == group_id,
                GroupMembership.user_id == user_id,
            )
        ).scalar_one_or_none()
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not part of the group")


class GroupQueryService:
    """Read-only helpers for retrieving group aggregates."""

    @staticmethod
    def list_groups(db: Session) -> Iterable[Group]:
        return db.execute(select(Group)).scalars().all()
