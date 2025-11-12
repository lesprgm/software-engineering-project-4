from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import get_settings, Settings
from ..database import get_db
from ..dependencies.auth import create_access_token
from ..schemas.auth import AuthResponse, LoginRequest, SignupRequest
from ..schemas.user import UserCreate
from ..services.users import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user_id: str, settings: Settings, user) -> AuthResponse:
    token = create_access_token(user_id, settings)
    return AuthResponse(access_token=token, user=user)


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(
    payload: SignupRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    user = UserService.create_user(
        db,
        UserCreate(
            email=payload.email,
            display_name=payload.display_name,
            password=payload.password,
        ),
    )
    return _auth_response(user.id, settings, user)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    user = UserService.authenticate(db, email=payload.email, password=payload.password)
    return _auth_response(user.id, settings, user)
