from __future__ import annotations

import hashlib
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.user import User
from ..schemas.user import UserCreate, UserProfileUpdate


class UserService:
    @staticmethod
    def _normalize_strings(items: Optional[List[str]]) -> Optional[List[str]]:
        if items is None:
            return None
        normalized = []
        for item in items:
            if not isinstance(item, str):
                continue
            stripped = item.strip()
            if stripped and stripped not in normalized:
                normalized.append(stripped)
        return normalized

    @staticmethod
    def _hash_password(password: Optional[str]) -> Optional[str]:
        if not password:
            return None
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    @staticmethod
    def _verify_password(password: str, password_hash: Optional[str]) -> bool:
        if not password_hash:
            return False
        return hashlib.sha256(password.encode("utf-8")).hexdigest() == password_hash

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    @classmethod
    def create_user(cls, db: Session, payload: UserCreate) -> User:
        exists = cls.get_by_email(db, payload.email)
        if exists:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        user = User(
            email=payload.email,
            display_name=payload.display_name,
            bio=payload.bio,
            interests=cls._normalize_strings(payload.interests),
            photos=cls._normalize_strings(payload.photos) or [],
            pronouns=payload.pronouns,
            location=payload.location,
            password_hash=cls._hash_password(payload.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @classmethod
    def update_profile(cls, db: Session, user: User, update: UserProfileUpdate) -> User:
        if update.display_name is not None:
            user.display_name = update.display_name
        if update.bio is not None:
            user.bio = update.bio
        if update.interests is not None:
            user.interests = cls._normalize_strings(update.interests)
        if update.pronouns is not None:
            user.pronouns = update.pronouns
        if update.location is not None:
            user.location = update.location
        if update.photos is not None:
            user.photos = cls._normalize_strings(update.photos) or []
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def append_photo(db: Session, user: User, url: str) -> User:
        photos = list(user.photos or [])
        if url not in photos:
            photos.append(url)
        user.photos = photos
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @classmethod
    def authenticate(cls, db: Session, *, email: str, password: str) -> User:
        user = cls.get_by_email(db, email)
        if not user or not cls._verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        return user
