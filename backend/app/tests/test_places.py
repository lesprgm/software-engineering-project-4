from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from fastapi.testclient import TestClient

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
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
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


def test_place_reviews_update_rating(client: TestClient):
    place_payload = {
        "name": "Campus Cafe",
        "location": "Student Center",
        "tags": ["coffee", "study"],
        "latitude": 37.0,
        "longitude": -122.0,
    }
    place = client.post("/places/", json=place_payload)
    assert place.status_code == 201
    place_id = place.json()["id"]

    review1 = client.post(
        f"/places/{place_id}/reviews",
        json={"reviewer_name": "Alex", "rating": 5, "comment": "Great spot"},
    )
    assert review1.status_code == 201

    review2 = client.post(
        f"/places/{place_id}/reviews",
        json={"reviewer_name": "Blake", "rating": 3, "comment": "Too busy"},
    )
    assert review2.status_code == 201

    detail = client.get(f"/places/{place_id}")
    assert detail.status_code == 200
    data = detail.json()
    assert data["review_count"] == 2
    assert data["rating"] == 4.0


def test_nearby_places_filter(client: TestClient):
    near = {
        "name": "Library Terrace",
        "location": "Main Quad",
        "latitude": 37.0,
        "longitude": -122.0,
        "tags": ["study"],
    }
    far = {
        "name": "Downtown Park",
        "location": "City Center",
        "latitude": 38.5,
        "longitude": -120.0,
        "tags": ["outdoors"],
    }
    assert client.post("/places/", json=near).status_code == 201
    assert client.post("/places/", json=far).status_code == 201

    response = client.get("/places/nearby", params={"lat": 37.0, "lng": -122.0, "radius_km": 5})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Library Terrace"
