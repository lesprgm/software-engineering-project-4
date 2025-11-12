from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    location: str
    category: str
    start_time: datetime
    end_time: datetime
    tags: List[str] = Field(default_factory=list)

    @validator("tags", pre=True, always=True)
    def ensure_tags(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @validator("end_time")
    def end_after_start(cls, value, values):
        start = values.get("start_time")
        if start and value <= start:
            raise ValueError("end_time must be after start_time")
        return value


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    id: int

    class Config:
        orm_mode = True


class EventQueryFilters(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    category: Optional[str] = None
