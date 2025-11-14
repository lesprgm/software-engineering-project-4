from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import User
from app.schemas.ai import DirectChatRequest
from app.services.ai_service import AIService
from app.services.matching import MatchingService


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_generate_user_matches_includes_demo_personas_when_alone(db_session):
    solo = User(email="solo@example.com", display_name="Solo Student")
    db_session.add(solo)
    db_session.commit()

    matches = MatchingService.generate_user_matches(db_session, solo.id, limit=3)
    assert len(matches) == 3
    assert all(candidate.user_id.startswith("demo-") for candidate in matches)
    assert all(candidate.tagline for candidate in matches)


def test_direct_reply_uses_persona_prompt(monkeypatch):
    captured = {}

    def fake_generate(cls, prompt: str):
        captured["prompt"] = prompt
        return "All good!", None

    monkeypatch.setattr(AIService, "_generate_and_moderate", classmethod(fake_generate))

    request = DirectChatRequest(
        user_name="Sam",
        partner_name="Ava from Makerspace",
        partner_id="demo-ava",
        message="Want to plan a prototyping session?",
    )
    reply = AIService.generate_direct_reply(request)

    assert reply == "All good!"
    assert "Ava from Makerspace" in captured["prompt"]
    assert "makerspace" in captured["prompt"]
    assert "Late-night prototyper" in captured["prompt"]
