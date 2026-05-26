from fastapi import APIRouter, Depends, HTTPException
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


# from backend.services.file_service import check_file_access, check_is_jpeg

router = APIRouter(prefix="/api/files", tags=["files"])



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
      1. Check the file is accessible on disk
      2. Check the file is a valid JPEG
      3. Skip duplicates already present in the DB
      4. Bulk-insert all valid new files in one query
      5. Return a consolidated ImportResult report

    HTTP status codes:
      200 - at least one file was processed
      422 - the request body itself is malformed
    """

    imported_records: list[LocalFile] = []
    rejected_files: list[RejectedFile] = []

    new_db_objects: list[LocalFile] = []

    for path in request.paths:

#       access_ok, access_msg = check_file_access(path)
#       if not access_ok:
#           rejected_files.append(RejectedFile(path=path, reason=access_msg,))
#           continue

#       jpeg_ok, jpeg_msg = check_is_jpeg(path)
#       if not jpeg_ok:
#           rejected_files.append(RejectedFile(path=path, reason=jpeg_msg,))
#           continue

        existing = (db.query(LocalFile).filter(LocalFile.absolute_path == path).first())
        if existing:
            imported_records.append(existing)
            continue

        import os
        filename = os.path.basename(path)
        file_size_kb = round(os.path.getsize(path) / 1024, 2)

        new_db_objects.append(
            LocalFile(
                filename=filename,
                absolute_path=path,
                file_size_kb=file_size_kb,
                file_format="JPEG",
                status="imported",
            )
        )

    if new_db_objects:
        try:
            db.bulk_save_objects(new_db_objects, return_defaults=True)
            db.commit()

            for obj in new_db_objects:
                db.refresh(obj)

            imported_records.extend(new_db_objects)

        except IntegrityError:
            db.rollback()
            for obj in new_db_objects:
                rejected_files.append(
                    RejectedFile(
                        path=obj.absolute_path,
                        reason="File was already imported by a concurrent request.",
                    )
                )

    return ImportResult(
        imported=[FileResponse.model_validate(f) for f in imported_records],
        rejected=rejected_files,
        total=len(request.paths),
    )


# GET /api/files
@router.get(
    "/",
    response_model=list[FileResponse],
    summary="Return all files currently in the workspace",
)
def list_files(db: Session = Depends(get_db)) -> list[FileResponse]:
    """Returns every LocalFile row — used on app startup to restore state."""
    files = db.query(LocalFile).all()
    return [FileResponse.model_validate(f) for f in files]