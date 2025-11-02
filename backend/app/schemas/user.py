from datetime import datetime
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
