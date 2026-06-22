import os
from pathlib import Path

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models import LocalFile
from backend.schemas import FileResponse, ImportResult, RejectedFile
from backend.services.thumbnail_service import (
    PreviewGenerationError,
    preview_generator,
)

class FileImportService:
    """Validates and imports JPEG files into the local workspace."""

    allowed_extensions = {".jpg", ".jpeg"}

    def validate_and_import(
        self,
        paths: list[str],
        db: Session,
    ) -> ImportResult:
        imported_records: list[LocalFile] = []
        rejected_files: list[RejectedFile] = []
        new_db_objects: list[LocalFile] = []

        for path in paths:
            existing = (
                db.query(LocalFile).filter(LocalFile.absolute_path == path).first()
            )
            if existing:
                imported_records.append(existing)
                continue

            source_path = Path(path)

            if not self.has_supported_extension(source_path.name):
                rejected_files.append(
                    RejectedFile(
                        path=path,
                        reason="Only .jpg and .jpeg files can be imported.",
                    )
                )
                continue

            access_error = self.get_file_access_error(source_path)
            if access_error:
                rejected_files.append(
                    RejectedFile(
                        path=path,
                        reason=access_error,
                    )
                )
                continue

            try:
                preview_generator.validate_jpeg(path)
                file_size_kb = round(source_path.stat().st_size / 1024, 2)

                if file_size_kb > 50 * 1024:
                    rejected_files.append(RejectedFile(path=path, reason="File exceeds 50 MB limit."))
                    continue
            except (OSError, PreviewGenerationError) as exc:
                rejected_files.append(
                    RejectedFile(
                        path=path,
                        reason=str(exc) or "File could not be imported.",
                    )
                )
                continue

            try:
                preview_generator.generate(path)
            except PreviewGenerationError:
                pass

            new_db_objects.append(
                LocalFile(
                    filename=source_path.name,
                    absolute_path=path,
                    file_size_kb=file_size_kb,
                    file_format="JPEG",
                    status="imported",
                )
            )

        imported_records.extend(
            self._save_imported_records(db, new_db_objects, rejected_files)
        )

        return ImportResult(
            imported=[FileResponse.model_validate(f) for f in imported_records],
            rejected=rejected_files,
            total=len(paths),
        )

    def has_supported_extension(self, filename: str) -> bool:
        return Path(filename).suffix.lower() in self.allowed_extensions

    def get_file_access_error(self, source_path: Path) -> str | None:
        if not source_path.exists():
            return "File does not exist on disk."

        if not source_path.is_file():
            return "Path does not point to a file."

        if not os.access(source_path, os.R_OK):
            return "File is not readable."

        return None

    def _save_imported_records(
        self,
        db: Session,
        records: list[LocalFile],
        rejected_files: list[RejectedFile],
    ) -> list[LocalFile]:
        if not records:
            return []

        try:
            db.add_all(records)
            db.commit()

            for record in records:
                db.refresh(record)

            return records
        except IntegrityError:
            db.rollback()
            for record in records:
                rejected_files.append(
                    RejectedFile(
                        path=record.absolute_path,
                        reason="File was already imported by a concurrent request.",
                    )
                )
            return []


file_import_service = FileImportService()
