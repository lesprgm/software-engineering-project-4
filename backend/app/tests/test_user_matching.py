from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User


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
    app.state._session_local = TestingSession

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    if hasattr(app.state, "_session_local"):
        delattr(app.state, "_session_local")
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _create_user(session, *, email: str, name: str, interests: list[str], bio: str) -> User:
    user = User(
        email=email,
        password_hash="test",
        display_name=name,
        interests=interests,
        bio=bio,
        created_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_user_matches_endpoint_returns_ranked_candidates(client: TestClient):
    session_factory = client.app.state._session_local
    with session_factory() as session:
        alex = _create_user(
            session,
            email="alex@example.com",
            name="Alex",
            interests=["hiking", "coffee", "films"],
            bio="Outdoorsy and creative planner.",
        )
        blair = _create_user(
            session,
            email="blair@example.com",
            name="Blair",
            interests=["coffee", "hiking", "tech"],
            bio="Creative extrovert who is outdoorsy.",
        )
        casey = _create_user(
            session,
            email="casey@example.com",
            name="Casey",
            interests=["gaming"],
            bio="Stays indoors.",
        )
        alex_id = alex.id
        blair_id = blair.id
        casey_id = casey.id

    response = client.get(f"/matches/users/{alex_id}", params={"limit": 5})
    assert response.status_code == 200
    payload = response.json()
    assert "candidates" in payload
    assert payload["candidates"]
    top = payload["candidates"][0]
    assert top["user_id"] == blair_id
    assert top["compatibility_score"] > 0
    assert casey_id not in {candidate["user_id"] for candidate in payload["candidates"]}
