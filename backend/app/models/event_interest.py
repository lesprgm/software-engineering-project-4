# backend/app/models/event_interest.py
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, DateTime, func
from ..database import Base

class EventInterest(Base):
    __tablename__ = "event_interests"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), nullable=False, index=True)  # reference to your Users table id/email/uuid as string
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_user_interest"),)
