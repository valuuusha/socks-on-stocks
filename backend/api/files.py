from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse as ThumbnailFileResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import LocalFile
from backend.schemas import (
    FileImportRequest,
    FileResponse,
    ImportResult,
    RejectedFile,
)
from backend.services.thumbnail_service import (
    PreviewGenerationError,
    preview_generator,
)
from backend.services.upload_storage_service import (
    UploadStorageError,
    StoredUpload,
    upload_storage,
)

router = APIRouter(prefix="/api/files", tags=["files"])


def _save_imported_records(
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

# POST /api/files/import
@router.post(
    "/import",
    response_model=ImportResult,
    status_code=200,
    summary="Import one or more JPEG files into the workspace",
)
def import_files(
    request: FileImportRequest,
    db: Session = Depends(get_db),
) -> ImportResult:
    """
    Accepts a list of absolute file paths from the frontend.

    For each path the endpoint will:
      1. Skip duplicates already present in the DB
      2. Check the file is accessible on disk
      3. Check the file is a valid JPEG
      4. Create a cached thumbnail when possible
      5. Insert all valid new files
      6. Return a consolidated ImportResult report

    HTTP status codes:
      200 - at least one file was processed
      422 - the request body itself is malformed
    """

    imported_records: list[LocalFile] = []
    rejected_files: list[RejectedFile] = []

    new_db_objects: list[LocalFile] = []

    for path in request.paths:
        existing = (db.query(LocalFile).filter(LocalFile.absolute_path == path).first())
        if existing:
            imported_records.append(existing)
            continue

        source_path = Path(path)

        try:
            preview_generator.validate_jpeg(path)
            file_size_kb = round(source_path.stat().st_size / 1024, 2)
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
        _save_imported_records(db, new_db_objects, rejected_files)
    )

    return ImportResult(
        imported=[FileResponse.model_validate(f) for f in imported_records],
        rejected=rejected_files,
        total=len(request.paths),
    )


# POST /api/files/upload
@router.post(
    "/upload",
    response_model=ImportResult,
    status_code=200,
    summary="Upload one or more JPEG files into the workspace",
)
async def upload_files(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> ImportResult:
    """
    Browser-friendly import path.

    The frontend sends the actual JPEG bytes as multipart/form-data. The backend
    stores a local copy, validates it, creates a thumbnail when possible, and
    keeps the stored absolute path in the workspace DB.
    """

    imported_records: list[LocalFile] = []
    rejected_files: list[RejectedFile] = []
    new_db_objects: list[LocalFile] = []
    stored_uploads: list[StoredUpload] = []
    pending_upload_paths: set[str] = set()

    for upload in files:
        try:
            stored = await upload_storage.save(upload)
        except UploadStorageError as exc:
            rejected_files.append(
                RejectedFile(
                    path=upload.filename or "uploaded file",
                    reason=str(exc) or "File could not be uploaded.",
                )
            )
            continue

        existing = (
            db.query(LocalFile)
            .filter(LocalFile.absolute_path == stored.absolute_path)
            .first()
        )
        if existing:
            imported_records.append(existing)
            continue

        if stored.absolute_path in pending_upload_paths:
            continue

        try:
            preview_generator.validate_jpeg(stored.absolute_path)
        except PreviewGenerationError as exc:
            upload_storage.delete_if_unused(stored.absolute_path)
            rejected_files.append(
                RejectedFile(
                    path=stored.original_filename,
                    reason=str(exc) or "File could not be imported.",
                )
            )
            continue

        try:
            preview_generator.generate(stored.absolute_path)
        except PreviewGenerationError:
            pass

        stored_uploads.append(stored)
        pending_upload_paths.add(stored.absolute_path)
        new_db_objects.append(
            LocalFile(
                filename=stored.original_filename,
                absolute_path=stored.absolute_path,
                file_size_kb=stored.file_size_kb,
                file_format="JPEG",
                status="imported",
            )
        )

    saved_records = _save_imported_records(db, new_db_objects, rejected_files)
    imported_records.extend(saved_records)

    if len(saved_records) != len(new_db_objects):
        saved_paths = {record.absolute_path for record in saved_records}
        for stored in stored_uploads:
            if stored.absolute_path not in saved_paths:
                upload_storage.delete_if_unused(stored.absolute_path)

    return ImportResult(
        imported=[FileResponse.model_validate(f) for f in imported_records],
        rejected=rejected_files,
        total=len(files),
    )


# GET /api/files/{file_id}/thumbnail
@router.get(
    "/{file_id}/thumbnail",
    response_class=ThumbnailFileResponse,
    summary="Return a cached JPEG thumbnail for an imported file",
)
def get_file_thumbnail(
    file_id: int,
    db: Session = Depends(get_db),
) -> ThumbnailFileResponse:
    file_record = db.get(LocalFile, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File was not found.")

    try:
        thumbnail_path = preview_generator.generate(file_record.absolute_path)
    except PreviewGenerationError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ThumbnailFileResponse(
        thumbnail_path,
        media_type="image/jpeg",
        filename=f"{file_record.id}-thumbnail.jpg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# GET /api/files
@router.get(
    "/",
    response_model=list[FileResponse],
    summary="Return all files currently in the workspace",
)
def list_files(db: Session = Depends(get_db)) -> list[FileResponse]:
    """Returns every LocalFile row; used on app startup to restore state."""
    files = db.query(LocalFile).all()
    return [FileResponse.model_validate(f) for f in files]
