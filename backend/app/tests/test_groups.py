from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import User
from app.main import app


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    testing_session = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        future=True,
        expire_on_commit=False,
    )

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.state._session_local = testing_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    if hasattr(app.state, "_session_local"):
        delattr(app.state, "_session_local")
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _create_user(client: TestClient, email: str, display_name: str) -> User:
    session_factory = client.app.state._session_local
    with session_factory() as session:
        user = User(email=email, display_name=display_name)
        session.add(user)
        session.commit()
        session.refresh(user)
        return user


def test_create_group_with_plain_token_without_owner_id(client: TestClient) -> None:
    owner = _create_user(client, "plain-token@example.com", "Plain Token User")
    headers = {"Authorization": f"Bearer {owner.id}"}

    response = client.post(
        "/groups/",
        json={
            "name": "Dev Token Group",
            "description": "Created using dev bypass token only",
        },
        headers=headers,
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "Dev Token Group"
    assert payload["invite_code"]
    assert payload["id"]


def test_group_scheduling_flow(client: TestClient) -> None:
    owner = _create_user(client, "owner@example.com", "Owner")
    attendee = _create_user(client, "member@example.com", "Member")

    create_response = client.post(
        "/groups/",
        json={
            "name": "Study Buddies",
            "description": "Weekly study hall",
            "owner_id": owner.id,
        },
    )
    assert create_response.status_code == 201
    group_data = create_response.json()
    group_id = group_data["id"]
    invite_code = group_data["invite_code"]

    join_response = client.post(
        f"/groups/{group_id}/join",
        json={"user_id": attendee.id, "invite_code": invite_code},
    )
    assert join_response.status_code == 200
    join_data = join_response.json()
    member_ids = {member["user"]["id"] for member in join_data["members"]}
    assert {owner.id, attendee.id} == member_ids

    now = datetime.now(timezone.utc).replace(microsecond=0)
    slots = [
        (
            owner.id,
            now + timedelta(hours=1),
            now + timedelta(hours=3),
        ),
        (
            attendee.id,
            now + timedelta(hours=1, minutes=30),
            now + timedelta(hours=4),
        ),
    ]

    for user_id, start, end in slots:
        availability_response = client.post(
            f"/groups/{group_id}/availability",
            json={
                "user_id": user_id,
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "timezone": "UTC",
            },
        )
        assert availability_response.status_code == 201

    suggestions_response = client.post(
        f"/groups/{group_id}/suggestions",
        json={"duration_minutes": 60, "window_days": 3, "limit": 5},
    )
    assert suggestions_response.status_code == 200
    suggestions_data = suggestions_response.json()
    assert "suggestions" in suggestions_data
    assert suggestions_data["suggestions"]

    suggestion = suggestions_data["suggestions"][0]
    assert set(suggestion["participant_ids"]) == {owner.id, attendee.id}
    assert suggestion["conflicts"] == []

    meeting_response = client.post(
        f"/groups/{group_id}/meetings",
        json={
            "user_id": owner.id,
            "start_time": suggestion["start_time"],
            "end_time": suggestion["end_time"],
            "title": "Bring snacks",
        },
    )
    assert meeting_response.status_code == 201
    meeting_data = meeting_response.json()
    assert meeting_data["group_id"] == group_id
    assert meeting_data["note"] == "Bring snacks"

    message_response = client.post(
        f"/groups/{group_id}/messages",
        json={"user_id": owner.id, "content": "See you there!"},
    )
    assert message_response.status_code == 201

    messages_listing = client.get(f"/groups/{group_id}/messages")
    assert messages_listing.status_code == 200
    messages_data = messages_listing.json()
    assert messages_data["total"] == 1
    assert messages_data["messages"][0]["content"] == "See you there!"


def test_group_matching_returns_candidates(client: TestClient) -> None:
    owner_a = _create_user(client, "owner_a@example.com", "Owner A")
    owner_b = _create_user(client, "owner_b@example.com", "Owner B")

    response_a = client.post(
        "/groups/",
        json={
            "name": "Group A",
            "description": "First group",
            "owner_id": owner_a.id,
        },
    )
    response_b = client.post(
        "/groups/",
        json={
            "name": "Group B",
            "description": "Second group",
            "owner_id": owner_b.id,
        },
    )
    assert response_a.status_code == 201
    assert response_b.status_code == 201
    group_a = response_a.json()
    group_b = response_b.json()

    now = datetime.now(timezone.utc).replace(microsecond=0)
    overlap_start = now + timedelta(hours=2)
    overlap_end = overlap_start + timedelta(hours=2)

    for group_id, owner_id in ((group_a["id"], owner_a.id), (group_b["id"], owner_b.id)):
        availability_response = client.post(
            f"/groups/{group_id}/availability",
            json={
                "user_id": owner_id,
                "start_time": overlap_start.isoformat(),
                "end_time": overlap_end.isoformat(),
                "timezone": "UTC",
            },
        )
        assert availability_response.status_code == 201

    matches_response = client.get(f"/groups/{group_a['id']}/matches", params={"limit": 3})
    assert matches_response.status_code == 200
    matches_data = matches_response.json()
    assert "candidates" in matches_data
    assert matches_data["candidates"]
    candidate_ids = {candidate["group_id"] for candidate in matches_data["candidates"]}
    assert group_b["id"] in candidate_ids
    compatibility_scores = [candidate["compatibility_score"] for candidate in matches_data["candidates"]]
    assert any(score > 0 for score in compatibility_scores)
