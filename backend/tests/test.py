import pytest
from app.models.place import Place
from app.database import Base, SessionLocal, engine

# Create a new test database schema before tests run
@pytest.fixture(scope="module")
def test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_create_place(test_db):
    """Test creating and saving a Place object"""
    new_place = Place(
        name="Test Hangout Spot",
        description="A chill spot for study sessions and friends.",
        location="Campus Center",
        rating=4.5,
        tags="study, chill, cafe",
        photo_url="https://example.com/photo.jpg"
    )

    test_db.add(new_place)
    test_db.commit()
    test_db.refresh(new_place)

    assert new_place.id is not None
    assert new_place.name == "Test Hangout Spot"
    assert new_place.rating == 4.5
