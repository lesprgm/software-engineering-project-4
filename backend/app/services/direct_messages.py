from __future__ import annotations

from datetime import datetime
from typing import List, Optional
import asyncio

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..models.direct_message import DirectMessage
from ..models.user import User
from ..schemas.ai import DirectChatRequest
from .ai_service import AIService


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

        recipient = cls._get_user(db, recipient_id)
        sender = cls._get_user(db, sender_id)
        message_text = (content or "").strip()
        if not message_text:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content cannot be empty")
        if len(message_text) > cls.MAX_LENGTH:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message exceeds maximum length")

        message = DirectMessage(sender_id=sender_id, recipient_id=recipient_id, content=message_text)
        db.add(message)
        db.commit()
        db.refresh(message)
        
        # Auto-respond if recipient is a demo user (has personality in bio)
        if recipient.bio and "[Personality:" in recipient.bio:
            cls._generate_ai_response(db, sender=sender, recipient=recipient, incoming_message=message_text)
        
        return message
    
    @classmethod
    def _generate_ai_response(cls, db: Session, *, sender: User, recipient: User, incoming_message: str) -> None:
        """Generate and send an AI-powered response from demo user."""
        try:
            # Extract personality from bio
            bio_text = recipient.bio or ""
            personality = ""
            if "[Personality:" in bio_text:
                start = bio_text.find("[Personality:") + len("[Personality:")
                end = bio_text.find("]", start)
                if end != -1:
                    personality = bio_text[start:end].strip()
            
            # Create AI request
            chat_request = DirectChatRequest(
                user_name=sender.display_name or "there",
                partner_id=recipient.id,
                partner_name=recipient.display_name or "Friend",
                message=incoming_message
            )
            
            # Generate response using AI
            ai_reply = AIService.generate_direct_reply(chat_request)
            
            # Send the AI response back
            response_message = DirectMessage(
                sender_id=recipient.id,
                recipient_id=sender.id,
                content=ai_reply
            )
            db.add(response_message)
            db.commit()
        except Exception as e:
            # Don't fail the original message if AI response fails
            print(f"Failed to generate AI response: {e}")
            pass

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
