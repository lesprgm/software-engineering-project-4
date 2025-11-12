from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _example_event_payload():
    start = datetime.now(timezone.utc) + timedelta(days=1)
    end = start + timedelta(hours=2)
    return {
        "title": "Campus Concert",
        "description": "Student bands and open mic.",
        "location": "Lowry Center",
        "category": "music",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": ["music", "community"],
    }


def test_event_interest_flow(client: TestClient):
    payload = _example_event_payload()
    create = client.post("/events/", json=payload)
    assert create.status_code == 201
    event_id = create.json()["id"]

    update = client.put(f"/events/{event_id}", json={"location": "Campus Green"})
    assert update.status_code == 200
    assert update.json()["location"] == "Campus Green"

    viewer_id = "user-123"
    list_response = client.get("/events/", params={"viewer_id": viewer_id})
    assert list_response.status_code == 200
    initial_event = list_response.json()[0]
    assert initial_event["viewer_interest"] is False
    assert initial_event["interest_count"] == 0

    interest = client.post(f"/events/{event_id}/interest", json={"user_id": viewer_id, "interested": True})
    assert interest.status_code == 201

    after_interest = client.get("/events/", params={"viewer_id": viewer_id}).json()[0]
    assert after_interest["viewer_interest"] is True
    assert after_interest["interest_count"] == 1
