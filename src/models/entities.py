"""Core data entities used across the app."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(slots=True)
class ImageMetadata:
    """Metadata fields editable in the UI."""

    title: str = ""
    description: str = ""
    keywords: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ImportedImage:
    """Represents an imported image file and current metadata values."""

    path: Path
    md5_hash: str
    metadata: ImageMetadata = field(default_factory=ImageMetadata)

    @property
    def filename(self) -> str:
        """Return filename extracted from the image path."""
        return self.path.name


@dataclass(slots=True)
class FTPProfile:
    """FTP connection profile stored in the database."""

    name: str
    host: str
    username: str
    password: str
    port: int = 21
    remote_path: str = "/"
    passive: bool = True
