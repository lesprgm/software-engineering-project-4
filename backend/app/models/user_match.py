from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, String, UniqueConstraint
from ..database import Base


class UserMatch(Base):
    """Tracks user swipes and matches."""
    __tablename__ = "user_matches"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    target_user_id = Column(String, nullable=False, index=True)
    swiped_right = Column(Boolean, nullable=False)  # True = right swipe, False = left swipe
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        UniqueConstraint('user_id', 'target_user_id', name='uq_user_target'),
    )
