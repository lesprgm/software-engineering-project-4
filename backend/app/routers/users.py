from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from ..config import get_settings, Settings
from ..database import get_db
from ..dependencies.auth import get_current_user
from ..models.user import User
from ..schemas.user import (
    PhotoUploadResponse,
    UserCreate,
    UserProfileRead,
    UserProfileUpdate,
)
from ..services.storage import PhotoStorage
from ..services.users import UserService
from pydantic import EmailStr

router = APIRouter(prefix="/users", tags=["users"])


def get_photo_storage(settings: Settings = Depends(get_settings)) -> PhotoStorage:
    base_path = Path(settings.media_root).resolve()
    return PhotoStorage(base_path=base_path, base_url=settings.media_base_url, max_bytes=settings.max_photo_size)


@router.post("/", response_model=UserProfileRead, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserProfileRead:
    user = UserService.create_user(db, payload)
    return user


@router.get("/lookup", response_model=UserProfileRead)
def lookup_user(email: EmailStr, db: Session = Depends(get_db)) -> UserProfileRead:
    user = UserService.get_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/me", response_model=UserProfileRead)
def get_profile(me: User = Depends(get_current_user)) -> UserProfileRead:
    return me


@router.patch("/me", response_model=UserProfileRead)
def update_profile(
    payload: UserProfileUpdate,
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfileRead:
    updated = UserService.update_profile(db, me, payload)
    return updated


@router.post("/me/photos", response_model=PhotoUploadResponse)
def upload_photo(
    file: UploadFile = File(...),
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: PhotoStorage = Depends(get_photo_storage),
) -> PhotoUploadResponse:
    url = storage.save(file)
    updated = UserService.append_photo(db, me, url)
    return PhotoUploadResponse(url=url, photos=updated.photos or [])
