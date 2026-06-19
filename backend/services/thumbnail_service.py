from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


class PreviewGenerationError(Exception):
    """Raised when a thumbnail cannot be generated safely."""


class PreviewGenerator:
    """Creates and caches small JPEG thumbnails for imported images."""

    def __init__(
        self,
        max_size: tuple[int, int] = (256, 256),
        cache_dir: Path | None = None,
        quality: int = 82,
    ) -> None:
        self.max_size = max_size
        self.quality = quality
        data_dir = os.getenv("SOCKS_ON_STOCKS_DATA_DIR")
        self.cache_dir = cache_dir or (
            Path(data_dir).expanduser().resolve() / "thumbnails"
            if data_dir
            else Path(tempfile.gettempdir()) / "socks_on_stocks_thumbnails"
        )
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def generate(self, source_path: str) -> Path:
        source, stat = self._get_source(source_path)

        thumbnail_path = self._thumbnail_path(source, stat.st_size, stat.st_mtime_ns)
        if thumbnail_path.exists():
            return thumbnail_path

        temp_path = self._temporary_path(thumbnail_path)

        try:
            with Image.open(source) as image:
                if image.format != "JPEG":
                    raise PreviewGenerationError("Only JPEG images can be previewed.")

                image.draft("RGB", self.max_size)
                image = ImageOps.exif_transpose(image)
                image.thumbnail(self.max_size, Image.Resampling.LANCZOS)

                if image.mode != "RGB":
                    image = image.convert("RGB")

                image.save(
                    temp_path,
                    format="JPEG",
                    quality=self.quality,
                    optimize=True,
                    progressive=True,
                )

            temp_path.replace(thumbnail_path)
            return thumbnail_path
        except PreviewGenerationError:
            raise
        except (OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
            raise PreviewGenerationError("Preview could not be generated.") from exc
        finally:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)

    def validate_jpeg(self, source_path: str) -> None:
        source, _ = self._get_source(source_path)

        try:
            with Image.open(source) as image:
                if image.format != "JPEG":
                    raise PreviewGenerationError("Only JPEG images can be imported.")
                image.verify()
        except PreviewGenerationError:
            raise
        except (OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
            raise PreviewGenerationError("File is not a readable JPEG image.") from exc

    def _thumbnail_path(self, source: Path, size: int, modified_ns: int) -> Path:
        key = f"{source.resolve()}:{size}:{modified_ns}:{self.max_size}".encode("utf-8")
        digest = hashlib.sha256(key).hexdigest()
        return self.cache_dir / f"{digest}.jpg"

    def _get_source(self, source_path: str) -> tuple[Path, os.stat_result]:
        source = Path(source_path)

        try:
            stat = source.stat()
        except OSError as exc:
            raise PreviewGenerationError("File is not accessible on disk.") from exc

        if not source.is_file():
            raise PreviewGenerationError("Path does not point to a file.")

        return source, stat

    def _temporary_path(self, thumbnail_path: Path) -> Path:
        descriptor, temp_name = tempfile.mkstemp(
            dir=self.cache_dir,
            prefix=f"{thumbnail_path.stem}-",
            suffix=".tmp",
        )
        os.close(descriptor)
        return Path(temp_name)


preview_generator = PreviewGenerator()
