from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    invite_code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    members: Mapped[list["GroupMembership"]] = relationship(
        "GroupMembership", back_populates="group", cascade="all, delete-orphan"
    )
    availabilities: Mapped[list["Availability"]] = relationship(
        "Availability", back_populates="group", cascade="all, delete-orphan"
    )
    messages: Mapped[list["GroupMessage"]] = relationship(
        "GroupMessage", back_populates="group", cascade="all, delete-orphan"
    )
    meetings: Mapped[list["GroupMeeting"]] = relationship(
        "GroupMeeting", back_populates="group", cascade="all, delete-orphan"
    )


class GroupMembership(Base):
    """Associates users with a group and tracks their role."""
    __tablename__ = "group_memberships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String, default="member", nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    group: Mapped[Group] = relationship("Group", back_populates="members")
    user = relationship("User", backref="group_memberships")


class Availability(Base):
    """Stores a single availability window for a user within a group."""
    __tablename__ = "availabilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String, default="UTC", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    group: Mapped[Group] = relationship("Group", back_populates="availabilities")
    user = relationship("User", backref="availabilities")


class GroupMessage(Base):
    """Lightweight group chat storage."""
    __tablename__ = "group_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    group: Mapped[Group] = relationship("Group", back_populates="messages")


class GroupMeeting(Base):
    """Represents a confirmed meeting suggestion."""
    __tablename__ = "group_meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    suggested_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"))
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    group: Mapped[Group] = relationship("Group", back_populates="meetings")
