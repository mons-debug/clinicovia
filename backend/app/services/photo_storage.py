"""
Photo storage abstraction.

Default backend: local filesystem under app/uploads/. Swap to S3/R2 by
replacing this module — the api/v1/photos endpoints only call save()
and open() so the rest of the app doesn't care about the backend.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import IO


_ROOT = Path(os.environ.get("PHOTO_STORAGE_ROOT", "/app/uploads"))


def _path_for(storage_key: str) -> Path:
    # storage_key looks like "<clinic_id>/<patient_id>/<uuid>.<ext>"
    return _ROOT / storage_key


def save(*, clinic_id: uuid.UUID, patient_id: uuid.UUID, ext: str, data: bytes) -> tuple[str, int]:
    """Persist `data` and return (storage_key, size_bytes)."""
    safe_ext = (ext or "").lstrip(".").lower()
    if safe_ext not in {"jpg", "jpeg", "png", "webp", "heic", "heif"}:
        safe_ext = "jpg"
    fid = uuid.uuid4().hex
    rel = f"{clinic_id}/{patient_id}/{fid}.{safe_ext}"
    full = _path_for(rel)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(data)
    return rel, len(data)


def open_bytes(storage_key: str) -> bytes:
    p = _path_for(storage_key)
    if not p.exists():
        raise FileNotFoundError(storage_key)
    return p.read_bytes()


def remove(storage_key: str) -> None:
    p = _path_for(storage_key)
    if p.exists():
        p.unlink()
