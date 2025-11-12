from __future__ import annotations

import imghdr
from pathlib import Path
from typing import Iterable
from uuid import uuid4

from fastapi import UploadFile, HTTPException, status


class PhotoStorage:
    ALLOWED_CONTENT_TYPES: dict[str, str] = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    def __init__(self, base_path: Path, base_url: str, max_bytes: int = 5 * 1024 * 1024):
        self.base_path = base_path
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.base_url = base_url.rstrip("/")
        self.max_bytes = max_bytes

    def _validate_content_type(self, file: UploadFile) -> str:
        if file.content_type not in self.ALLOWED_CONTENT_TYPES:
            allowed = ", ".join(self.ALLOWED_CONTENT_TYPES.keys())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported content type. Allowed: {allowed}",
            )
        return self.ALLOWED_CONTENT_TYPES[file.content_type]

    def save(self, file: UploadFile) -> str:
        suffix = self._validate_content_type(file)
        filename = f"{uuid4().hex}{suffix}"
        file_path = self.base_path / filename
        total = 0

        with file_path.open("wb") as buffer:
            for chunk in self._read_in_chunks(file.file):
                total += len(chunk)
                if total > self.max_bytes:
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Photo exceeds maximum size limit",
                    )
                buffer.write(chunk)

        if not self._is_valid_image(file_path):
            file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is not a valid image",
            )

        return f"{self.base_url}/{filename}"

    @staticmethod
    def _read_in_chunks(file_obj, chunk_size: int = 1024 * 1024) -> Iterable[bytes]:
        while True:
            chunk = file_obj.read(chunk_size)
            if not chunk:
                break
            yield chunk

    @staticmethod
    def _is_valid_image(path: Path) -> bool:
        kind = imghdr.what(path)
        return kind in {"jpeg", "png", "webp"}
