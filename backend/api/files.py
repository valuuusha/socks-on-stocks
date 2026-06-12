import os
import io
import zipfile
import subprocess
import shutil
import tempfile
from pathlib import Path
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

BACKEND_DIR = Path(__file__).resolve().parents[1]
EXIFTOOL_PERL = BACKEND_DIR / "exiftool_files" / "perl.exe"
EXIFTOOL_SCRIPT = BACKEND_DIR / "exiftool_files" / "exiftool.pl"
EXIFTOOL_EXE = BACKEND_DIR / "exiftool.exe"

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

def _get_exiftool_command() -> list[str]:
    if EXIFTOOL_PERL.exists() and EXIFTOOL_SCRIPT.exists():
        return [str(EXIFTOOL_PERL), str(EXIFTOOL_SCRIPT)]
    if EXIFTOOL_EXE.exists():
        return [str(EXIFTOOL_EXE)]
    return ["exiftool"]


def _write_exif_data(file_path: str, title: str, description: str, keywords: list[str]):
    cmd = [
        *_get_exiftool_command(),
        "-overwrite_original",
        "-charset",
        "UTF8",
        "-IPTC:CodedCharacterSet=UTF8",
    ]
    
    if title:
        cmd.extend([
            f"-XMP:Title={title}",
            f"-IPTC:ObjectName={title}",
            f"-EXIF:XPTitle={title}",
            f"-EXIF:XPSubject={title}",
        ])
    if description:
        cmd.extend([
            f"-XMP:Description={description}",
            f"-IPTC:Caption-Abstract={description}",
            f"-EXIF:ImageDescription={description}",
            f"-EXIF:XPComment={description}",
            f"-EXIF:UserComment={description}",
        ])
    if keywords and len(keywords) > 0:
        kw_str = ", ".join(keywords)
        windows_keywords = "; ".join(keywords)
        cmd.extend([
            "-sep",
            ", ",
            f"-XMP:Subject={kw_str}",
            f"-IPTC:Keywords={kw_str}",
            f"-EXIF:XPKeywords={windows_keywords}",
        ])
    if len(cmd) > 6:
        cmd.append(file_path)
        result = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            cwd=str(BACKEND_DIR),
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode != 0:
            message = result.stderr.strip() or result.stdout.strip() or "ExifTool failed."
            raise RuntimeError(message)

def _resolve_local_file_path(file_record: LocalFile, db: Session) -> Path | None:
    resolved_path = upload_storage.resolve_existing_path(file_record.absolute_path)
    if resolved_path is None:
        return None

    normalized_path = str(resolved_path.resolve())
    if file_record.absolute_path != normalized_path:
        file_record.absolute_path = normalized_path
        db.add(file_record)

    return resolved_path

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
    requested_file_ids = list(dict.fromkeys(request.file_ids))
    if not requested_file_ids:
        raise HTTPException(status_code=400, detail="No files selected for export.")

    files_to_export = (
        db.query(LocalFile)
        .filter(LocalFile.id.in_(requested_file_ids), LocalFile.status != "removed")
        .all()
    )
    files_by_id = {file_record.id: file_record for file_record in files_to_export}
    missing_ids = [file_id for file_id in requested_file_ids if file_id not in files_by_id]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Selected files were not found in the workspace: {missing_ids}.",
        )

    export_items: list[tuple[LocalFile, Path]] = []
    missing_files: list[str] = []

    for file_id in requested_file_ids:
        file_record = files_by_id[file_id]
        source_path = _resolve_local_file_path(file_record, db)
        if source_path is None:
            missing_files.append(file_record.filename)
            continue
        export_items.append((file_record, source_path))

    if missing_files:
        raise HTTPException(
            status_code=404,
            detail=f"Selected files are not accessible on disk: {', '.join(missing_files)}.",
        )

    if db.dirty:
        db.commit()
    
    zip_buffer = io.BytesIO()
    seen_names = {}

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        with tempfile.TemporaryDirectory(prefix="socks_on_stocks_export_") as temp_dir:
            temp_export_dir = Path(temp_dir)

            for file_record, source_path in export_items:
                meta = db.query(FileMetadata).filter(FileMetadata.file_id == file_record.id).first()
                
                title = meta.title if meta and meta.title else ""
                description = meta.description if meta and meta.description else ""
                keywords = meta.keywords if meta and meta.keywords else []
                
                name = Path(file_record.filename).name or f"file-{file_record.id}.jpg"
                if name in seen_names:
                    seen_names[name] += 1
                    name_part, ext_part = os.path.splitext(name)
                    arcname = f"{name_part} ({seen_names[name]}){ext_part}"
                else:
                    seen_names[name] = 0
                    arcname = name

                export_copy_path = temp_export_dir / arcname
                shutil.copy2(source_path, export_copy_path)

                try:
                    _write_exif_data(str(export_copy_path), title, description, keywords)
                except RuntimeError as exc:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Metadata could not be written for {file_record.filename}: {exc}",
                    ) from exc
                    
                zip_file.write(export_copy_path, arcname=arcname)

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
    source_path = _resolve_local_file_path(file_record, db)
    if source_path is None:
        raise HTTPException(status_code=404, detail="File is not accessible on disk.")
    if db.dirty:
        db.commit()
    try:
        thumbnail_path = preview_generator.generate(str(source_path))
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
    for file_record in files:
        _resolve_local_file_path(file_record, db)
    if db.dirty:
        db.commit()
    return [FileResponse.model_validate(f) for f in files]

@router.delete("/{file_id}", status_code=204)
def delete_file_from_workspace(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(LocalFile).filter(LocalFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File was not found.")

    source_path = _resolve_local_file_path(db_file, db)
    if source_path is not None:
        try:
            source_path.unlink()
        except OSError as e:
            print(f"Failed to delete physical file: {e}")

    db_file.status = "removed"
    db.commit()
    return
