from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


class UserBase(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=120)


class UserProfileFields(BaseModel):
    bio: Optional[str] = Field(default=None, max_length=2000)
    interests: Optional[List[str]] = None
    photos: Optional[List[str]] = None
    pronouns: Optional[str] = Field(default=None, max_length=60)
    location: Optional[str] = Field(default=None, max_length=120)

    @validator("interests", "photos", pre=True)
    def normalize_list(cls, value):
        if value is None:
            return value
        if isinstance(value, list):
            return [item for item in value if isinstance(item, str) and item.strip()]
        return value


class UserCreate(UserBase, UserProfileFields):
    password: Optional[str] = Field(default=None, min_length=8, max_length=64)


class UserProfileRead(UserBase, UserProfileFields):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True


class UserProfileUpdate(UserProfileFields):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=120)


class PhotoUploadResponse(BaseModel):
    url: str
    photos: List[str]


class UserRead(UserProfileRead):
    """Backward-compatible schema for modules that expect UserRead."""


class UserMatchCandidate(BaseModel):
    user_id: str
    display_name: str
    compatibility_score: float
    shared_interests: List[str]
    schedule_score: float
    personality_overlap: float
    bio: Optional[str] = None
    tagline: Optional[str] = None
    photos: Optional[List[str]] = None


class UserMatchResponse(BaseModel):
    candidates: List[UserMatchCandidate]


class SwipeAction(BaseModel):
    target_user_id: str
    swiped_right: bool  # True = right swipe (interested), False = left swipe (not interested)


class SwipeResponse(BaseModel):
    is_mutual_match: bool
    message: str
