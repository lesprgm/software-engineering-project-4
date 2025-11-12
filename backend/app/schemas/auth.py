from pydantic import BaseModel, EmailStr, Field

from .user import UserProfileRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=64)


class SignupRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=8, max_length=64)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileRead
