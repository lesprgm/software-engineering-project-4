from pydantic import BaseModel
from typing import Optional


class PlaceBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    rating: Optional[float] = 0.0
    tags: Optional[str] = None
    photo_url: Optional[str] = None


class PlaceCreate(PlaceBase):
    """Schema used when creating a new Place"""
    pass


class PlaceOut(PlaceBase):
    id: int

    class Config:
        orm_mode = True