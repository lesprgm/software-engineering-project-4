from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone
import uuid

from ..database import get_db
from ..schemas.user import UserMatchResponse, SwipeAction, SwipeResponse, UserMatchCandidate
from ..services.matching import MatchingService
from ..models.user import User
from ..models.user_match import UserMatch

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/users/{user_id}", response_model=UserMatchResponse)
def user_matches(
    user_id: str,
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> UserMatchResponse:
    """Get match candidates (users you haven't swiped on yet)."""
    # Get all users this person has already swiped on
    swiped_user_ids = set(
        db.execute(
            select(UserMatch.target_user_id).where(UserMatch.user_id == user_id)
        ).scalars().all()
    )
    
    # Get all candidates
    all_candidates = MatchingService.generate_user_matches(db, user_id=user_id, limit=100)
    
    # Filter out already-swiped users
    unswiped_candidates = [
        c for c in all_candidates if c.user_id not in swiped_user_ids
    ]
    
    return UserMatchResponse(candidates=unswiped_candidates[:limit])


@router.post("/users/{user_id}/swipe", response_model=SwipeResponse)
def record_swipe(
    user_id: str,
    swipe: SwipeAction,
    db: Session = Depends(get_db),
) -> SwipeResponse:
    """Record a swipe action and check for mutual match."""
    # Prevent self-swipe
    if user_id == swipe.target_user_id:
        raise HTTPException(status_code=400, detail="Cannot swipe on yourself")
    
    # Check if already swiped
    existing = db.execute(
        select(UserMatch).where(
            UserMatch.user_id == user_id,
            UserMatch.target_user_id == swipe.target_user_id
        )
    ).scalar_one_or_none()
    
    if existing:
        # Update existing swipe
        existing.swiped_right = swipe.swiped_right
        existing.created_at = datetime.now(timezone.utc)
    else:
        # Create new swipe record
        new_match = UserMatch(
            id=str(uuid.uuid4()),
            user_id=user_id,
            target_user_id=swipe.target_user_id,
            swiped_right=swipe.swiped_right,
        )
        db.add(new_match)
    
    db.commit()
    
    # Check for mutual match (both users swiped right)
    is_mutual = False
    if swipe.swiped_right:
        reciprocal_swipe = db.execute(
            select(UserMatch).where(
                UserMatch.user_id == swipe.target_user_id,
                UserMatch.target_user_id == user_id,
                UserMatch.swiped_right == True
            )
        ).scalar_one_or_none()
        
        if reciprocal_swipe:
            is_mutual = True
            message = "It's a match! 🎉"
        else:
            message = "Swipe recorded. Waiting for them to swipe back!"
    else:
        message = "User skipped."
    
    return SwipeResponse(is_mutual_match=is_mutual, message=message)


@router.get("/users/{user_id}/mutual", response_model=UserMatchResponse)
def get_mutual_matches(
    user_id: str,
    db: Session = Depends(get_db),
) -> UserMatchResponse:
    """Get only mutual matches (both users swiped right)."""
    # Get users this person swiped right on
    my_right_swipes = set(
        db.execute(
            select(UserMatch.target_user_id).where(
                UserMatch.user_id == user_id,
                UserMatch.swiped_right == True
            )
        ).scalars().all()
    )
    
    # Get users who swiped right on this person
    their_right_swipes = set(
        db.execute(
            select(UserMatch.user_id).where(
                UserMatch.target_user_id == user_id,
                UserMatch.swiped_right == True
            )
        ).scalars().all()
    )
    
    # Mutual matches are the intersection
    mutual_match_ids = my_right_swipes & their_right_swipes
    
    if not mutual_match_ids:
        return UserMatchResponse(candidates=[])
    
    # Build detailed candidate profiles for mutual matches
    candidates = []
    primary_user = db.get(User, user_id)
    if not primary_user:
        return UserMatchResponse(candidates=[])
    
    primary_profile = MatchingService._build_user_profile(db, primary_user)
    
    for match_id in mutual_match_ids:
        match_user = db.get(User, match_id)
        if not match_user:
            continue
        
        profile = MatchingService._build_user_profile(db, match_user)
        score_data = MatchingService._score_user_profiles(primary_profile, profile)
        
        candidates.append(
            UserMatchCandidate(
                user_id=match_user.id,
                display_name=match_user.display_name,
                compatibility_score=score_data["overall"],
                shared_interests=sorted(score_data["shared_interests"]),
                schedule_score=score_data["schedule_score"],
                personality_overlap=score_data["trait_score"],
                bio=match_user.bio,
                tagline=getattr(match_user, 'tagline', None),
                photos=match_user.photos if match_user.photos else None,
            )
        )
    
    # Sort by compatibility
    candidates.sort(key=lambda c: c.compatibility_score, reverse=True)
    
    return UserMatchResponse(candidates=candidates)


@router.get("/users/{user_id}/right-swipes", response_model=UserMatchResponse)
def get_right_swipes(
    user_id: str,
    db: Session = Depends(get_db),
) -> UserMatchResponse:
    """Get all users this person swiped right on (for demo purposes - shows in messages even without mutual match)."""
    # Get users this person swiped right on
    my_right_swipes = set(
        db.execute(
            select(UserMatch.target_user_id).where(
                UserMatch.user_id == user_id,
                UserMatch.swiped_right == True
            )
        ).scalars().all()
    )
    
    if not my_right_swipes:
        return UserMatchResponse(candidates=[])
    
    # Build detailed candidate profiles
    candidates = []
    primary_user = db.get(User, user_id)
    if not primary_user:
        return UserMatchResponse(candidates=[])
    
    primary_profile = MatchingService._build_user_profile(db, primary_user)
    
    for match_id in my_right_swipes:
        match_user = db.get(User, match_id)
        if not match_user:
            continue
        
        profile = MatchingService._build_user_profile(db, match_user)
        score_data = MatchingService._score_user_profiles(primary_profile, profile)
        
        candidates.append(
            UserMatchCandidate(
                user_id=match_user.id,
                display_name=match_user.display_name,
                compatibility_score=score_data["overall"],
                shared_interests=sorted(score_data["shared_interests"]),
                schedule_score=score_data["schedule_score"],
                personality_overlap=score_data["trait_score"],
                bio=match_user.bio,
                tagline=getattr(match_user, 'tagline', None),
                photos=match_user.photos if match_user.photos else None,
            )
        )
    
    # Sort by compatibility
    candidates.sort(key=lambda c: c.compatibility_score, reverse=True)
    
    return UserMatchResponse(candidates=candidates)
