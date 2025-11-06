from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship

from app.database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    invite_code = Column(String, nullable=False, unique=True)

    # Relationships
    members = relationship("GroupMembership", back_populates="group", cascade="all, delete-orphan")
    availabilities = relationship("Availability", back_populates="group", cascade="all, delete-orphan")
    messages = relationship("GroupMessage", back_populates="group", cascade="all, delete-orphan")
    meetings = relationship("GroupMeeting", back_populates="group", cascade="all, delete-orphan")


class GroupMembership(Base):
    __tablename__ = "group_memberships"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    group_id = Column(String, ForeignKey("groups.id"))
    role = Column(String, default="member")

    # relationships
    group = relationship("Group", back_populates="members")
    user = relationship("User")


class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid4()))
    group_id = Column(String, ForeignKey("groups.id"))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    group = relationship("Group", back_populates="messages")
    user = relationship("User")


class GroupMeeting(Base):
    __tablename__ = "group_meetings"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid4()))
    group_id = Column(String, ForeignKey("groups.id"))
    topic = Column(String, nullable=True)
    location = Column(String, nullable=True)
    scheduled_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)
    suggested_by = Column(String, nullable=True)
    note = Column(Text, nullable=True)

    group = relationship("Group", back_populates="meetings")


class Availability(Base):
    __tablename__ = "availability"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid4()))
    group_id = Column(String, ForeignKey("groups.id"))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    timezone = Column(String, nullable=True)

    group = relationship("Group", back_populates="availabilities")
