from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, Integer, Text, JSON

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    bio = Column(Text, nullable=True)
    interests = Column(JSON, nullable=True)
    photos = Column(JSON, nullable=JSON)

#    gender = Column(String)
#   age = Column(Integer)
#    interests = Column(JSON)
#   personality = Column(JSON)

    def __repr__(self) -> str:
        return f"User(id={self.id}, email={self.email!r})"
