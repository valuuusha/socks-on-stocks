from __future__ import annotations

import hashlib
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile


class UploadStorageError(Exception):
    """Raised when an uploaded file cannot be stored safely."""


@dataclass(frozen=True)
class StoredUpload:
    original_filename: str
    absolute_path: str
    file_size_kb: float


class UploadStorage:
    """Stores browser-uploaded images as local files the backend can process."""

    def __init__(self, storage_dir: Path | None = None) -> None:
        data_dir = os.getenv("SOCKS_ON_STOCKS_DATA_DIR")
        self.storage_dir = storage_dir or (
            Path(data_dir).expanduser().resolve() / "imports"
            if data_dir
            else Path(__file__).resolve().parents[1] / "storage" / "imports"
        )
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, upload: UploadFile) -> StoredUpload:
        original_filename = self._safe_filename(upload.filename)
        extension = self._jpeg_extension(original_filename)
        temp_path = self._temporary_path()
        digest = hashlib.sha256()
        total_size = 0

        try:
            with temp_path.open("wb") as destination:
                while chunk := await upload.read(1024 * 1024):
                    total_size += len(chunk)
                    digest.update(chunk)
                    destination.write(chunk)

            if total_size == 0:
                raise UploadStorageError("Uploaded file is empty.")

            final_path = self.storage_dir / f"{digest.hexdigest()}{extension}"
            if final_path.exists():
                temp_path.unlink(missing_ok=True)
            else:
                temp_path.replace(final_path)

            return StoredUpload(
                original_filename=original_filename,
                absolute_path=str(final_path.resolve()),
                file_size_kb=round(total_size / 1024, 2),
            )
        except OSError as exc:
            raise UploadStorageError("Uploaded file could not be saved.") from exc
        finally:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
            await upload.close()

    def delete_if_unused(self, absolute_path: str) -> None:
        path = Path(absolute_path)

        try:
            path.relative_to(self.storage_dir)
        except ValueError:
            return

        path.unlink(missing_ok=True)

    def resolve_existing_path(self, absolute_path: str) -> Path | None:
        path = Path(absolute_path)
        if path.is_file():
            return path

        if path.parent.name != "imports" or path.parent.parent.name != "storage":
            return None

        candidate = self.storage_dir / path.name
        if candidate.is_file():
            return candidate

        return None

    def _safe_filename(self, filename: str | None) -> str:
        clean_name = Path(filename or "uploaded.jpg").name
        clean_name = re.sub(r"[^A-Za-z0-9._ -]", "_", clean_name).strip(" .")
        return clean_name or "uploaded.jpg"

    def _jpeg_extension(self, filename: str) -> str:
        extension = Path(filename).suffix.lower()
        return ".jpeg" if extension == ".jpeg" else ".jpg"

    def _temporary_path(self) -> Path:
        descriptor, temp_name = tempfile.mkstemp(
            dir=self.storage_dir,
            prefix="upload-",
            suffix=".tmp",
        )
        os.close(descriptor)
        return Path(temp_name)


upload_storage = UploadStorage()
