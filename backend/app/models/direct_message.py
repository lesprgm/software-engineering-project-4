from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, Index, String, Text

from ..database import Base


class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    sender_id = Column(String, nullable=False, index=True)
    recipient_id = Column(String, nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_direct_messages_participants", "sender_id", "recipient_id", "created_at"),
    )
