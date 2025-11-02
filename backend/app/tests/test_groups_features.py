from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.models import Availability, Group, GroupMembership, GroupMessage, User
from app.services.groups import GroupService
from app.services.matching import MatchingService
from app.services.scheduling import AvailabilityService


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

    yield SessionLocal

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def db_session(session_factory):
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(session_factory):
    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


def _create_user(session, email: str, display_name: str) -> User:
    user = User(email=email, display_name=display_name)
    session.add(user)
    session.flush()
    return user


def test_generate_group_matches_handles_multiple_members(db_session):
    primary_owner = _create_user(db_session, "owner@example.com", "Owner One")
    primary_teammate = _create_user(db_session, "teammate@example.com", "Teammate Two")
    other_member_a = _create_user(db_session, "other-a@example.com", "Other A")
    other_member_b = _create_user(db_session, "other-b@example.com", "Other B")

    primary_group = Group(name="Primary", description=None, invite_code="primary-code")
    other_group = Group(name="Other", description=None, invite_code="other-code")
    db_session.add_all([primary_group, other_group])
    db_session.flush()

    db_session.add_all(
        [
            GroupMembership(group_id=primary_group.id, user_id=primary_owner.id, role="owner"),
            GroupMembership(group_id=primary_group.id, user_id=primary_teammate.id, role="member"),
            GroupMembership(group_id=other_group.id, user_id=other_member_a.id, role="owner"),
            GroupMembership(group_id=other_group.id, user_id=other_member_b.id, role="member"),
        ]
    )
    db_session.flush()

    window_start = datetime.now(timezone.utc) + timedelta(hours=1)
    AvailabilityService.add_window(
        db_session,
        group_id=primary_group.id,
        user_id=primary_owner.id,
        start_time=window_start,
        end_time=window_start + timedelta(hours=2),
        timezone_name="UTC",
    )
    AvailabilityService.add_window(
        db_session,
        group_id=primary_group.id,
        user_id=primary_teammate.id,
        start_time=window_start + timedelta(minutes=30),
        end_time=window_start + timedelta(hours=3),
        timezone_name="UTC",
    )
    AvailabilityService.add_window(
        db_session,
        group_id=other_group.id,
        user_id=other_member_a.id,
        start_time=window_start + timedelta(minutes=45),
        end_time=window_start + timedelta(hours=2, minutes=30),
        timezone_name="UTC",
    )
    AvailabilityService.add_window(
        db_session,
        group_id=other_group.id,
        user_id=other_member_b.id,
        start_time=window_start + timedelta(minutes=60),
        end_time=window_start + timedelta(hours=2, minutes=45),
        timezone_name="UTC",
    )
    db_session.commit()

    candidates = MatchingService.generate_group_matches(db_session, primary_group.id, limit=5)

    assert len(candidates) == 1
    assert candidates[0].group_id == other_group.id


def test_meeting_suggestions_respond_with_configured_defaults(client, session_factory):
    settings = get_settings()
    original_duration = settings.default_meeting_duration_minutes
    original_window = settings.meeting_window_days
    settings.default_meeting_duration_minutes = 45
    settings.meeting_window_days = 7

    try:
        session = session_factory()
        try:
            owner = _create_user(session, "group-owner@example.com", "Group Owner")
            group = Group(name="Config Group", description=None, invite_code="config-code")
            session.add(group)
            session.flush()
            group_id = group.id
            session.add(GroupMembership(group_id=group.id, user_id=owner.id, role="owner"))
            session.commit()
        finally:
            session.close()

        response = client.post(f"/groups/{group_id}/meeting-suggestions")
        assert response.status_code == 200
        payload = response.json()
        assert payload["preferences"] == {
            "duration_minutes": 45,
            "window_days": 7,
            "limit": 5,
        }
    finally:
        settings.default_meeting_duration_minutes = original_duration
        settings.meeting_window_days = original_window


def test_list_messages_preserves_ascending_order_across_pages(db_session):
    author = _create_user(db_session, "author@example.com", "Author")
    group = Group(name="Chat Group", description=None, invite_code="chat-code")
    db_session.add(group)
    db_session.flush()

    base_time = datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)
    messages = []
    for index in range(5):
        message = GroupMessage(
            group_id=group.id,
            user_id=author.id,
            content=f"message-{index}",
            created_at=base_time + timedelta(minutes=index),
        )
        db_session.add(message)
        messages.append(message)

    db_session.commit()

    first_page = GroupService.list_messages(db_session, group_id=group.id, limit=2, offset=0)
    second_page = GroupService.list_messages(db_session, group_id=group.id, limit=2, offset=2)

    combined = first_page.messages + second_page.messages
    timestamps = [message.created_at for message in combined]
    assert timestamps == sorted(timestamps)
    assert first_page.total == 5
