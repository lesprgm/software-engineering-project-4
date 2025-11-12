import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..config import get_settings, Settings
from ..database import get_db
from ..models.user import User

bearer_scheme = HTTPBearer(auto_error=True)
optional_bearer_scheme = HTTPBearer(auto_error=False)


def _encode_segment(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _encode_jwt(payload: Dict[str, Any], secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_segment = _encode_segment(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_segment = _encode_segment(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_segment = _encode_segment(signature)
    return f"{header_segment}.{payload_segment}.{signature_segment}"


def _decode_jwt(token: str, secret: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token",
        ) from exc

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature = _b64decode(signature_b64)
    if not hmac.compare_digest(expected_sig, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    payload_raw = _b64decode(payload_b64)
    try:
        return json.loads(payload_raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        ) from exc


def _b64decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def _resolve_user_id(token: str, settings: Settings) -> str:
    if settings.jwt_secret:
        payload = _decode_jwt(token, settings.jwt_secret)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject claim",
            )
        return user_id
    # Development fallback: treat bearer token as direct user id.
    return token


def _fetch_user(user_id: str, db: Session) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    user_id = _resolve_user_id(credentials.credentials, settings)
    return _fetch_user(user_id, db)


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User | None:
    if not credentials:
        return None
    user_id = _resolve_user_id(credentials.credentials, settings)
    try:
        return _fetch_user(user_id, db)
    except HTTPException:
        return None


def create_access_token(user_id: str, settings: Settings) -> str:
    if settings.jwt_secret:
        payload = {"sub": user_id, "iat": int(datetime.now(timezone.utc).timestamp())}
        return _encode_jwt(payload, settings.jwt_secret)
    return user_id
