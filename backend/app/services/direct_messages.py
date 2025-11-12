from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..models.direct_message import DirectMessage
from ..models.user import User


class DirectMessageService:
    MAX_LENGTH = 2000

    @staticmethod
    def _get_user(db: Session, user_id: str) -> User:
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    @classmethod
    def send_message(cls, db: Session, *, sender_id: str, recipient_id: str, content: str) -> DirectMessage:
        if sender_id == recipient_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot send messages to yourself")

        cls._get_user(db, recipient_id)
        message_text = (content or "").strip()
        if not message_text:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content cannot be empty")
        if len(message_text) > cls.MAX_LENGTH:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message exceeds maximum length")

        message = DirectMessage(sender_id=sender_id, recipient_id=recipient_id, content=message_text)
        db.add(message)
        db.commit()
        db.refresh(message)
        return message

    @classmethod
    def list_messages(
        cls,
        db: Session,
        *,
        user_id: str,
        partner_id: str,
        limit: int = 50,
        before: Optional[datetime] = None,
    ) -> List[DirectMessage]:
        cls._get_user(db, partner_id)

        query = (
            select(DirectMessage)
            .where(
                or_(
                    and_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == partner_id),
                    and_(DirectMessage.sender_id == partner_id, DirectMessage.recipient_id == user_id),
                )
            )
        )
        if before:
            query = query.where(DirectMessage.created_at < before)

        rows = (
            db.execute(
                query.order_by(DirectMessage.created_at.desc()).limit(limit)
            )
            .scalars()
            .all()
        )
        return list(reversed(rows))
