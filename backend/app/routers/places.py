from math import atan2, cos, radians, sin, sqrt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(
    prefix="/places",
    tags=["places"],
)

@router.post("/", response_model=schemas.PlaceOut, status_code=status.HTTP_201_CREATED)
def create_place(place: schemas.PlaceCreate, db: Session = Depends(get_db)):
    payload = place.dict()
    tags = payload.pop("tags", None)
    payload["tags"] = ",".join(tags) if tags else None
    db_place = models.Place(**payload)
    db.add(db_place)
    db.commit()
    db.refresh(db_place)
    return db_place

@router.get("/", response_model=List[schemas.PlaceOut])
def get_all_places(db: Session = Depends(get_db)):
    return db.query(models.Place).all()

@router.get("/top", response_model=List[schemas.PlaceOut])
def get_top_places(db: Session = Depends(get_db), limit: int = 5):
    return db.query(models.Place).order_by(models.Place.rating.desc()).limit(limit).all()

@router.get("/nearby", response_model=List[schemas.PlaceOut])
def get_nearby_places(
    *,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(1.5, gt=0),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> List[schemas.PlaceOut]:
    candidates = db.query(models.Place).filter(models.Place.latitude.isnot(None), models.Place.longitude.isnot(None)).all()
    results: list[tuple[float, models.Place]] = []
    for place in candidates:
        distance = _haversine(lat, lng, place.latitude, place.longitude)
        if distance <= radius_km:
            results.append((distance, place))
    results.sort(key=lambda item: (item[0], -item[1].rating))
    return [place for _, place in results[:limit]]


@router.get("/recommend", response_model=List[schemas.PlaceOut])
def recommend_places(
    interests: str = Query(..., description="Comma separated interests, e.g. cafe,study"),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    tags = [tag.strip().lower() for tag in interests.split(",") if tag.strip()]
    if not tags:
        return []
    results = db.query(models.Place).all()
    matches: list[tuple[int, models.Place]] = []
    for place in results:
        place_tags = (place.tags or "").lower().split(",")
        overlap = len({tag for tag in place_tags if tag.strip() in tags})
        if overlap:
            matches.append((overlap, place))
    matches.sort(key=lambda item: (-item[0], -item[1].rating))
    return [place for _, place in matches[:limit]]


@router.get("/date-ideas", response_model=List[schemas.DateIdeaSuggestion])
def date_ideas(
    interests: Optional[str] = Query(None, description="Comma separated interests."),
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
):
    interest_list = [tag.strip().lower() for tag in (interests.split(",") if interests else []) if tag.strip()]
    places = db.query(models.Place).order_by(models.Place.rating.desc()).limit(25).all()
    suggestions: list[schemas.DateIdeaSuggestion] = []
    for place in places:
        if len(suggestions) >= limit:
            break
        tag_text = (place.tags or "").lower()
        if interest_list and not any(tag in tag_text for tag in interest_list):
            continue
        reason = "Great for " + (", ".join(interest_list[:2]) if interest_list else "a relaxed hangout")
        idea = f"Meet at {place.name} and explore {place.location or 'campus'} afterwards."
        suggestions.append(schemas.DateIdeaSuggestion(place=place, idea=idea, reason=reason))
    return suggestions


@router.post(
    "/{place_id}/reviews",
    response_model=schemas.PlaceReviewRead,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    place_id: int,
    payload: schemas.PlaceReviewCreate,
    db: Session = Depends(get_db),
):
    place = db.get(models.Place, place_id)
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")
    review = models.PlaceReview(
        place_id=place.id,
        reviewer_name=payload.reviewer_name,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    _update_place_rating(place, payload.rating)
    db.commit()
    db.refresh(review)
    return review


@router.get("/{place_id}/reviews", response_model=List[schemas.PlaceReviewRead])
def list_reviews(place_id: int, db: Session = Depends(get_db)):
    place = db.get(models.Place, place_id)
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")
    return db.query(models.PlaceReview).filter(models.PlaceReview.place_id == place_id).order_by(models.PlaceReview.created_at.desc()).all()


@router.get("/{place_id}", response_model=schemas.PlaceOut)
def retrieve_place(place_id: int, db: Session = Depends(get_db)):
    place = db.get(models.Place, place_id)
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")
    return place


def _haversine(lat1: float, lon1: float, lat2: float | None, lon2: float | None) -> float:
    if lat2 is None or lon2 is None:
        return float("inf")
    r = 6371  # km
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def _update_place_rating(place: models.Place, new_rating: float) -> None:
    count = (place.review_count or 0) + 1
    total = (place.rating or 0.0) * (place.review_count or 0) + new_rating
    place.review_count = count
    place.rating = round(total / count, 2)
