from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas

router = APIRouter(
    prefix="/places",
    tags=["places"],
)

@router.post("/", response_model=schemas.PlaceOut)
def create_place(place: schemas.PlaceCreate, db: Session = Depends(get_db)):
    db_place = models.Place(**place.dict())
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

@router.get("/recommend", response_model=List[schemas.PlaceOut])
def recommend_places(interests: str, db: Session = Depends(get_db)):
    """
    Example: /places/recommend?interests=cafe,study
    """
    tags = interests.lower().split(",")
    results = db.query(models.Place).all()
    recommendations = [p for p in results if any(t in p.tags.lower() for t in tags)]
    return recommendations[:5]

