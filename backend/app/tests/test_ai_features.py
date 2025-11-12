from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _build_participants():
    return [
        {
            "name": "Alex",
            "bio": "Business major who loves coffee tastings",
            "interests": ["coffee", "startups"],
            "shared_activities": ["campus tour"],
        },
        {
            "name": "Jordan",
            "bio": "Outdoor club lead and podcast fan",
            "interests": ["hiking", "coffee"],
            "shared_activities": ["volunteer day"],
        },
    ]


def test_match_insight_generation_and_cache(client: TestClient):
    match_id = "match-123"
    request_body = {
        "participants": _build_participants(),
        "shared_interests": ["coffee", "volunteering"],
        "shared_activities": ["hackathon"],
        "location": "Campus Center",
        "mood": "upbeat",
    }

    first = client.post(f"/matches/{match_id}/insight", json=request_body)
    assert first.status_code == 200
    first_payload = first.json()
    assert first_payload["match_id"] == match_id
    assert first_payload["cached"] is False
    assert "summary_text" in first_payload

    cached = client.get(f"/matches/{match_id}/insight")
    assert cached.status_code == 200
    cached_payload = cached.json()
    assert cached_payload["cached"] is True
    assert cached_payload["summary_text"]


def test_date_ideas_use_cache_and_places(client: TestClient):
    place_response = client.post(
        "/places/",
        json={
            "name": "Lowry Cafe",
            "description": "Cozy late-night coffee bar",
            "location": "Lowry Center",
            "rating": 4.8,
            "tags": "coffee,study",
            "photo_url": None,
        },
    )
    assert place_response.status_code in (200, 201)

    match_id = "match-ideas-1"
    now = datetime.now(timezone.utc)
    request = {
        "match_id": match_id,
        "shared_interests": ["coffee tastings", "live music"],
        "location": "Lowry Center",
        "availability_window": {
            "start": (now + timedelta(days=1)).isoformat(),
            "end": (now + timedelta(days=1, hours=4)).isoformat(),
        },
        "mood": "creative",
        "participants": _build_participants(),
    }

    generated = client.post("/ideas", json=request)
    assert generated.status_code == 200
    generated_payload = generated.json()
    assert generated_payload["cached"] is False
    assert len(generated_payload["ideas"]) == 3

    cached = client.get("/ideas", params={"match_id": match_id})
    assert cached.status_code == 200
    cached_payload = cached.json()
    assert cached_payload["cached"] is True
    assert len(cached_payload["ideas"]) == 3


def test_event_nlp_search_interprets_filters(client: TestClient):
    now = datetime.now(timezone.utc).replace(microsecond=0)
    friday = now + timedelta(days=(4 - now.weekday()) % 7)
    concert_start = friday.replace(hour=20, minute=0, second=0)
    concert_end = concert_start + timedelta(hours=2)

    create_event = {
        "title": "Lowry Live Concert",
        "description": "Indie bands and open mic.",
        "location": "Lowry Center",
        "category": "music",
        "start_time": concert_start.isoformat(),
        "end_time": concert_end.isoformat(),
        "tags": ["concert", "music"],
    }
    response = client.post("/events/", json=create_event)
    assert response.status_code in (200, 201)

    query = "What's happening this Friday near Lowry? Looking for a concert."
    search = client.get("/events/nlp-search", params={"q": query})
    assert search.status_code == 200
    payload = search.json()
    assert payload["cached"] is False
    assert payload["events"], "Should return at least one event"
    assert any("Lowry" in event["location"] for event in payload["events"])

    cached = client.get("/events/nlp-search", params={"q": query})
    assert cached.status_code == 200
    assert cached.json()["cached"] is True
