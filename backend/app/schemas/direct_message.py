from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class DirectMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class DirectMessageRead(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    content: str
    created_at: datetime

    class Config:
        orm_mode = True


class DirectMessagePage(BaseModel):
    messages: List[DirectMessageRead]
