# backend/app/tests/test_events.py
import os
import tempfile
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db

# Create a temporary SQLite DB for tests
db_fd, db_path = tempfile.mkstemp(suffix=".db")
TEST_DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_create_and_get_event():
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Hackathon",
        "description": "24h coding",
        "location": "Student Center",
        "start_time": (now + timedelta(days=1)).isoformat(),
        "end_time": (now + timedelta(days=1, hours=4)).isoformat()
    }
    resp = client.post("/api/events", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    event_id = data["id"]

    # fetch it back
    resp2 = client.get(f"/api/events/{event_id}")
    assert resp2.status_code == 200
    assert resp2.json()["title"] == "Hackathon"

def test_list_upcoming_filtering():
    now = datetime.now(timezone.utc)

    # past event
    pe = {
        "title": "Last Week Concert",
        "start_time": (now - timedelta(days=7)).isoformat(),
        "end_time": (now - timedelta(days=7, hours=-2)).isoformat(),
        "location": "Auditorium"
    }
    # future event
    fe = {
        "title": "Next Week Talk",
        "start_time": (now + timedelta(days=7)).isoformat(),
        "end_time": (now + timedelta(days=7, hours=2)).isoformat(),
        "location": "Hall A"
    }
    client.post("/api/events", json=pe)
    client.post("/api/events", json=fe)

    r_upcoming = client.get("/api/events?upcoming=true")
    assert r_upcoming.status_code == 200
    titles = [e["title"] for e in r_upcoming.json()]
    assert "Next Week Talk" in titles
    assert "Last Week Concert" not in titles

    r_all = client.get("/api/events?upcoming=false")
    assert r_all.status_code == 200
    titles_all = [e["title"] for e in r_all.json()]
    assert "Last Week Concert" in titles_all
    assert "Next Week Talk" in titles_all

def test_interest_toggle():
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Career Fair",
        "start_time": (now + timedelta(days=3)).isoformat(),
        "location": "Gym"
    }
    r = client.post("/api/events", json=payload)
    event_id = r.json()["id"]

    # toggle on
    r1 = client.post(f"/api/events/{event_id}/interests", json={"user_id": "alice"})
    assert r1.status_code == 200
    assert r1.json()["interested_count"] == 1

    # toggle again (off)
    r2 = client.post(f"/api/events/{event_id}/interests", json={"user_id": "alice"})
    assert r2.status_code == 200
    assert r2.json()["interested_count"] == 0

def teardown_module(module):
    try:
        os.close(db_fd)
    except Exception:
        pass
    try:
        os.remove(db_path)
    except Exception:
        pass
