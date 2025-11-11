from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class PlaceBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    location: Optional[str] = Field(None, max_length=255)
    tags: Optional[List[str]] = None
    photo_url: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    @validator("tags", pre=True)
    def _coerce_tags(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            return [tag.strip() for tag in value.split(",") if tag.strip()]
        return value


class PlaceCreate(PlaceBase):
    pass


class PlaceReviewBase(BaseModel):
    reviewer_name: str = Field(..., max_length=255)
    rating: float = Field(..., ge=0, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class PlaceReviewCreate(PlaceReviewBase):
    pass


class PlaceReviewRead(PlaceReviewBase):
    id: int
    place_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class PlaceOut(PlaceBase):
    id: int
    rating: float = 0.0
    review_count: int = 0

    class Config:
        orm_mode = True


class DateIdeaSuggestion(BaseModel):
    place: PlaceOut
    idea: str
    reason: str
