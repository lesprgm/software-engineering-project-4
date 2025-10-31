from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.models import GroupMembership, GroupMessage, User
from app.services.groups import GroupService


def _create_user(db_session, idx: int = 0) -> User:
    user = User(id=f"user-{idx}", email=f"user{idx}@example.com", display_name=f"User {idx}")
    db_session.add(user)
    db_session.flush()
    return user


def test_create_group_assigns_owner_role(db_session):
    owner = _create_user(db_session)

    group = GroupService.create_group(
        db_session,
        name="Study Buddies",
        description="Bi-weekly study support",
        owner_id=owner.id,
    )
    db_session.commit()

    persisted = GroupService.get_group(db_session, group.id)
    assert persisted.invite_code
    assert len(persisted.members) == 1
    membership = persisted.members[0]
    assert membership.user_id == owner.id
    assert membership.role == "owner"


def test_join_group_validates_invite_code(db_session):
    owner = _create_user(db_session)
    participant = _create_user(db_session, idx=1)

    group = GroupService.create_group(
        db_session,
        name="Weekend Warriors",
        description=None,
        owner_id=owner.id,
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        GroupService.join_group(
            db_session,
            group_id=group.id,
            user_id=participant.id,
            invite_code="wrong-code",
        )
    assert exc.value.status_code == 403

    GroupService.join_group(
        db_session,
        group_id=group.id,
        user_id=participant.id,
        invite_code=group.invite_code,
    )
    db_session.commit()

    membership = (
        db_session.query(GroupMembership)
        .filter(GroupMembership.group_id == group.id, GroupMembership.user_id == participant.id)
        .one()
    )
    assert membership.role == "member"


def test_post_message_requires_membership(db_session):
    owner = _create_user(db_session)
    outsider = _create_user(db_session, idx=1)

    group = GroupService.create_group(
        db_session,
        name="Game Night",
        description="",
        owner_id=owner.id,
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        GroupService.post_message(
            db_session,
            group_id=group.id,
            user_id=outsider.id,
            content="Hello team!",
        )
    assert exc.value.status_code == 403


def test_list_messages_returns_chronological_order(db_session):
    owner = _create_user(db_session)
    member = _create_user(db_session, idx=1)

    group = GroupService.create_group(
        db_session,
        name="Hackathon Crew",
        description="",
        owner_id=owner.id,
    )
    GroupService.join_group(
        db_session,
        group_id=group.id,
        user_id=member.id,
        invite_code=group.invite_code,
    )
    db_session.commit()

    first = GroupService.post_message(
        db_session,
        group_id=group.id,
        user_id=owner.id,
        content="Kickoff at 5 PM",
    )
    second = GroupService.post_message(
        db_session,
        group_id=group.id,
        user_id=member.id,
        content="I'll bring snacks",
    )
    db_session.commit()

    messages = GroupService.list_messages(db_session, group_id=group.id, limit=10).messages
    assert [message.id for message in messages] == [first.id, second.id]
    assert messages[0].content == "Kickoff at 5 PM"
    assert messages[1].content == "I'll bring snacks"


def test_invite_link_contains_code(db_session):
    owner = _create_user(db_session)
    group = GroupService.create_group(
        db_session,
        name="Movie Night",
        description=None,
        owner_id=owner.id,
    )
    db_session.commit()

    link = GroupService.get_invite_link(group)
    assert group.invite_code in link
    assert link.startswith("https://")