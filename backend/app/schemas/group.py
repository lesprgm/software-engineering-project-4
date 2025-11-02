from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from .user import UserRead


class GroupBase(BaseModel):
    name: str = Field(..., description="Display name of the group")
    description: Optional[str] = Field(None, description="Optional group summary")


class GroupCreate(GroupBase):
    owner_id: str = Field(..., description="Identifier for the user creating the group")


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
    user_id: str
    invite_code: str


class InviteLinkResponse(BaseModel):
    group_id: str
    invite_code: str
    shareable_url: str


class GroupMatchCandidate(BaseModel):
    group_id: str
    compatibility_score: float
    summary: str


class GroupMatchResponse(BaseModel):
    group_id: str
    candidates: List[GroupMatchCandidate]


class GroupMessageCreate(BaseModel):
    user_id: str
    content: str = Field(..., min_length=1, max_length=1000)


class GroupMessageRead(BaseModel):
    id: int
    group_id: str
    user_id: Optional[str]
    content: str
    created_at: datetime

    class Config:
        orm_mode = True
