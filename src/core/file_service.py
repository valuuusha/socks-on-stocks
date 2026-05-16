"""File helpers for image import workflow."""

from __future__ import annotations

import hashlib
from pathlib import Path

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def is_image_file(path: Path) -> bool:
    """Return true when the path points to a supported image extension."""
    return path.suffix.lower() in SUPPORTED_EXTENSIONS


def calculate_md5(path: Path) -> str:
    """Calculate MD5 hash for file content."""
    digest = hashlib.md5()
    with path.open("rb") as file_obj:
        for chunk in iter(lambda: file_obj.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()
