from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator

from .user import UserRead


class GroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Display name of the group")
    description: Optional[str] = Field(None, max_length=500, description="Optional group summary")

    @validator('name')
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Group name cannot be empty')
        return v.strip()

    @validator('description')
    def description_strip(cls, v):
        if v:
            return v.strip()
        return v


class GroupCreate(GroupBase):
    owner_id: str | None = Field(default=None, description="Identifier for the user creating the group")


class GroupRead(GroupBase):
    id: str
    invite_code: str
    created_at: datetime

    class Config:
        orm_mode = True


class GroupMember(BaseModel):
    user: UserRead
    role: str
    joined_at: datetime

    class Config:
        orm_mode = True


class GroupDetail(GroupRead):
    members: List[GroupMember]

    class Config(GroupRead.Config):
        pass


class JoinGroupRequest(BaseModel):
    user_id: str | None = None
    invite_code: str = Field(..., min_length=1)


class InviteLinkResponse(BaseModel):
    invite_url: str


class GroupMatchCandidate(BaseModel):
    group_id: str
    group_name: str
    compatibility_score: float
    overlap_minutes: int
    size: int


class GroupMatchResponse(BaseModel):
    candidates: List[GroupMatchCandidate]


class GroupMessageCreate(BaseModel):
    user_id: str | None = None
    content: str = Field(..., min_length=1, max_length=1000)

    @validator('content')
    def content_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Message content cannot be empty')
        return v.strip()


class GroupMessageRead(BaseModel):
    id: int
    group_id: str
    user_id: Optional[str]
    content: str
    created_at: datetime

    class Config:
        orm_mode = True


class GroupMessagePage(BaseModel):
    total: int
    messages: List[GroupMessageRead]
