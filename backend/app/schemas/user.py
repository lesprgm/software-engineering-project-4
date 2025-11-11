from datetime import datetime
from typing import List

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    display_name: str


class UserCreate(UserBase):
    pass


class UserRead(UserBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True


class UserMatchCandidate(BaseModel):
    user_id: str
    display_name: str
    compatibility_score: float
    shared_interests: List[str]
    schedule_score: float
    personality_overlap: float


class UserMatchResponse(BaseModel):
    candidates: List[UserMatchCandidate]
