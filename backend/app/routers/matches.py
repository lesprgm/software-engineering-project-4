from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.user import UserMatchResponse
from ..services.matching import MatchingService

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/users/{user_id}", response_model=UserMatchResponse)
def user_matches(
    user_id: str,
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> UserMatchResponse:
    candidates = MatchingService.generate_user_matches(db, user_id=user_id, limit=limit)
    return UserMatchResponse(candidates=candidates)
