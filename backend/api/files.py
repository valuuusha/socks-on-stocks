import os
import io
import zipfile
import subprocess
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse as ThumbnailFileResponse, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import LocalFile, FileMetadata
from backend.schemas import (
    FileImportRequest,
    FileResponse,
    ImportResult,
    RejectedFile,
    ExportRequest,
)
from backend.services.thumbnail_service import (
    PreviewGenerationError,
    preview_generator,
)
from backend.services.file_service import file_import_service
from backend.services.upload_storage_service import (
    UploadStorageError,
    StoredUpload,
    upload_storage,
)

router = APIRouter(prefix="/api/files", tags=["files"])

def _save_imported_records(db: Session, records: list[LocalFile], rejected_files: list[RejectedFile]) -> list[LocalFile]:
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

def _write_exif_data(file_path: str, title: str, description: str, keywords: list[str]):    
    
    exiftool_cmd = "exiftool"
    if os.path.exists("backend/exiftool.exe"):
        exiftool_cmd = "backend/exiftool.exe"
    
    cmd = [exiftool_cmd, "-overwrite_original", "-charset", "UTF8"]
    
    if title:
        cmd.extend([f"-XMP:Title={title}", f"-IPTC:ObjectName={title}"])
    if description:
        cmd.extend([
            f"-XMP:Description={description}",
            f"-IPTC:Caption-Abstract={description}",
            f"-EXIF:ImageDescription={description}"
        ])
    if keywords and len(keywords) > 0:
        kw_str = ", ".join(keywords)
        cmd.extend(["-sep", ", ", f"-XMP:Subject={kw_str}", f"-IPTC:Keywords={kw_str}"])
    if len(cmd) > 4:
        cmd.append(file_path)
        try:
            subprocess.run(cmd, check=True, capture_output=True)
        except Exception as e:
            print(f"ExifTool error on {file_path}: {e}")

@router.post("/import", response_model=ImportResult, status_code=200)
def import_files(request: FileImportRequest, db: Session = Depends(get_db)) -> ImportResult:
    return file_import_service.validate_and_import(request.paths, db)

@router.post("/upload", response_model=ImportResult, status_code=200)
async def upload_files(files: list[UploadFile] = File(...), db: Session = Depends(get_db)) -> ImportResult:
    imported_records: list[LocalFile] = []
    rejected_files: list[RejectedFile] = []
    new_db_objects: list[LocalFile] = []
    stored_uploads: list[StoredUpload] = []
    pending_upload_paths: set[str] = set()

    for upload in files:
        if not file_import_service.has_supported_extension(upload.filename or ""):
            rejected_files.append(RejectedFile(path=upload.filename or "uploaded file", reason="Only .jpg and .jpeg files can be imported."))
            await upload.close()
            continue

        try:
            stored = await upload_storage.save(upload)
        except UploadStorageError as exc:
            rejected_files.append(RejectedFile(path=upload.filename or "uploaded file", reason=str(exc) or "File could not be uploaded."))
            continue

        existing = db.query(LocalFile).filter(LocalFile.absolute_path == stored.absolute_path).first()
        
        if existing:
            if getattr(existing, "status", None) == "removed":
                existing.status = "imported"
                db.commit()
                db.refresh(existing)
            imported_records.append(existing)
            continue

        if stored.absolute_path in pending_upload_paths:
            continue
        try:
            preview_generator.validate_jpeg(stored.absolute_path)
        except PreviewGenerationError as exc:
            upload_storage.delete_if_unused(stored.absolute_path)
            rejected_files.append(RejectedFile(path=stored.original_filename, reason=str(exc) or "File could not be imported."))
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

@router.post("/export")
def export_files(request: ExportRequest, db: Session = Depends(get_db)):
    files_to_export = db.query(LocalFile).filter(LocalFile.id.in_(request.file_ids)).all()
    
    zip_buffer = io.BytesIO()
    seen_names = {}

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for f in files_to_export:
            if os.path.exists(f.absolute_path):
                
                meta = db.query(FileMetadata).filter(FileMetadata.file_id == f.id).first()
                
                title = meta.title if meta and meta.title else ""
                description = meta.description if meta and meta.description else ""
                keywords = meta.keywords if meta and meta.keywords else []

                _write_exif_data(f.absolute_path, title, description, keywords)
                
                name = f.filename
                if name in seen_names:
                    seen_names[name] += 1
                    name_part, ext_part = os.path.splitext(name)
                    arcname = f"{name_part} ({seen_names[name]}){ext_part}"
                else:
                    seen_names[name] = 0
                    arcname = name
                    
                zip_file.write(f.absolute_path, arcname=arcname)

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=exported_stocks.zip"}
    )

@router.get("/{file_id}/thumbnail", response_class=ThumbnailFileResponse)
def get_file_thumbnail(file_id: int, db: Session = Depends(get_db)) -> ThumbnailFileResponse:
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

@router.get("/", response_model=list[FileResponse])
def list_files(db: Session = Depends(get_db)) -> list[FileResponse]:
    files = db.query(LocalFile).filter(LocalFile.status != "removed").all()
    return [FileResponse.model_validate(f) for f in files]

@router.delete("/{file_id}", status_code=204)
def delete_file_from_workspace(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(LocalFile).filter(LocalFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File was not found.")

    if os.path.exists(db_file.absolute_path):
        try:
            os.remove(db_file.absolute_path)
        except OSError as e:
            print(f"Failed to delete physical file: {e}")

    db_file.status = "removed"
    db.commit()
    return