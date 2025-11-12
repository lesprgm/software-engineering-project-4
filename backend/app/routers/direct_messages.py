from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_user
from ..models.user import User
from ..schemas.direct_message import DirectMessageCreate, DirectMessagePage, DirectMessageRead
from ..services.direct_messages import DirectMessageService

router = APIRouter(prefix="/direct-messages", tags=["direct-messages"])


@router.get("/{partner_id}", response_model=DirectMessagePage)
def list_direct_messages(
    partner_id: str,
    limit: int = Query(50, ge=1, le=200),
    before: Optional[datetime] = None,
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectMessagePage:
    messages = DirectMessageService.list_messages(
        db,
        user_id=me.id,
        partner_id=partner_id,
        limit=limit,
        before=before,
    )
    return DirectMessagePage(messages=messages)


@router.post("/{partner_id}", response_model=DirectMessageRead, status_code=201)
def send_direct_message(
    partner_id: str,
    payload: DirectMessageCreate,
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectMessageRead:
    message = DirectMessageService.send_message(
        db,
        sender_id=me.id,
        recipient_id=partner_id,
        content=payload.content,
    )
    return message
