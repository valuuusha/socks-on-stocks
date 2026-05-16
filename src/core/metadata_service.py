"""ExifTool-backed metadata read and write helpers."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from models.entities import ImageMetadata

try:
    import exiftool  # type: ignore
except ImportError:  # pragma: no cover - optional at runtime
    exiftool = None


class MetadataService:
    """Reads and writes image metadata via pyexiftool or subprocess fallback."""

    def read_metadata(self, image_path: Path) -> ImageMetadata:
        """Read title, description and keywords from image."""
        if exiftool is not None:
            return self._read_with_pyexiftool(image_path)
        return self._read_with_subprocess(image_path)

    def write_metadata(self, image_path: Path, metadata: ImageMetadata) -> None:
        """Write title, description and keywords to image."""
        if exiftool is not None:
            self._write_with_pyexiftool(image_path, metadata)
            return
        self._write_with_subprocess(image_path, metadata)

    def _read_with_pyexiftool(self, image_path: Path) -> ImageMetadata:
        with exiftool.ExifToolHelper() as helper:  # type: ignore[union-attr]
            result = helper.get_tags(
                [str(image_path)],
                tags=["XMP:Title", "EXIF:ImageDescription", "IPTC:Keywords"],
            )[0]
        return ImageMetadata(
            title=str(result.get("XMP:Title", "")),
            description=str(result.get("EXIF:ImageDescription", "")),
            keywords=self._normalize_keywords(result.get("IPTC:Keywords", [])),
        )

    def _write_with_pyexiftool(self, image_path: Path, metadata: ImageMetadata) -> None:
        args = [
            f"-XMP:Title={metadata.title}",
            f"-EXIF:ImageDescription={metadata.description}",
            "-IPTC:Keywords=",
        ]
        args.extend(f"-IPTC:Keywords+={keyword}" for keyword in metadata.keywords)
        with exiftool.ExifTool() as tool:  # type: ignore[union-attr]
            tool.execute("-overwrite_original", *args, str(image_path))

    def _read_with_subprocess(self, image_path: Path) -> ImageMetadata:
        command = [
            "exiftool",
            "-j",
            "-XMP:Title",
            "-EXIF:ImageDescription",
            "-IPTC:Keywords",
            str(image_path),
        ]
        output = self._run_exiftool(command)
        data = json.loads(output)[0]
        return ImageMetadata(
            title=str(data.get("Title", "")),
            description=str(data.get("ImageDescription", "")),
            keywords=self._normalize_keywords(data.get("Keywords", [])),
        )

    def _write_with_subprocess(self, image_path: Path, metadata: ImageMetadata) -> None:
        command = [
            "exiftool",
            "-overwrite_original",
            f"-XMP:Title={metadata.title}",
            f"-EXIF:ImageDescription={metadata.description}",
            "-IPTC:Keywords=",
            *[f"-IPTC:Keywords+={keyword}" for keyword in metadata.keywords],
            str(image_path),
        ]
        self._run_exiftool(command)

    @staticmethod
    def _normalize_keywords(raw_keywords: object) -> list[str]:
        if isinstance(raw_keywords, str):
            return [part.strip() for part in raw_keywords.split(",") if part.strip()]
        if isinstance(raw_keywords, list):
            return [str(part).strip() for part in raw_keywords if str(part).strip()]
        return []

    @staticmethod
    def _run_exiftool(command: list[str]) -> str:
        try:
            completed = subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError as error:
            raise RuntimeError("ExifTool executable not found on PATH.") from error
        except subprocess.CalledProcessError as error:
            raise RuntimeError(error.stderr.strip() or "ExifTool command failed.") from error
        return completed.stdout
