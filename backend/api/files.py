import os
import io
import subprocess
import threading
import tkinter as tk
from tkinter import filedialog
import platform
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
from backend.services.thumbnail_service import PreviewGenerationError, preview_generator
from backend.services.file_service import file_import_service
from backend.services.upload_storage_service import UploadStorageError, StoredUpload, upload_storage

router = APIRouter(prefix="/api/files", tags=["files"])

def get_backend_dir() -> Path:
    import sys
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS) / "backend"
    return Path(__file__).resolve().parents[1]

BACKEND_DIR = get_backend_dir()
EXIFTOOL_PERL = BACKEND_DIR / "exiftool_files" / "perl.exe"
EXIFTOOL_SCRIPT = BACKEND_DIR / "exiftool_files" / "exiftool.pl"
EXIFTOOL_EXE = BACKEND_DIR / "exiftool.exe"

def _get_subprocess_kwargs():
    kwargs = {}
    if platform.system() == "Windows":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return kwargs

def _get_exiftool_command() -> list[str]:
    if EXIFTOOL_PERL.exists() and EXIFTOOL_SCRIPT.exists():
        return [str(EXIFTOOL_PERL), str(EXIFTOOL_SCRIPT)]
    if EXIFTOOL_EXE.exists():
        return [str(EXIFTOOL_EXE)]
    return ["exiftool"]

def _write_exif_data(file_path: str, title: str, description: str, keywords: list[str]):
    cmd = [*_get_exiftool_command(), "-overwrite_original", "-charset", "UTF8", "-IPTC:CodedCharacterSet=UTF8"]
    if title:
        cmd.extend([f"-XMP:Title={title}", f"-IPTC:ObjectName={title}", f"-EXIF:XPTitle={title}", f"-EXIF:XPSubject={title}"])
    if description:
        cmd.extend([f"-XMP:Description={description}", f"-IPTC:Caption-Abstract={description}", f"-EXIF:ImageDescription={description}", f"-EXIF:XPComment={description}", f"-EXIF:UserComment={description}"])
    if keywords and len(keywords) > 0:
        kw_str = ", ".join(keywords)
        windows_keywords = "; ".join(keywords)
        cmd.extend(["-sep", ", ", f"-XMP:Subject={kw_str}", f"-IPTC:Keywords={kw_str}", f"-EXIF:XPKeywords={windows_keywords}"])
    
    if len(cmd) > 6:
        cmd.append(file_path)
        result = subprocess.run(
            cmd, check=False, capture_output=True, cwd=str(BACKEND_DIR),
            text=True, encoding="utf-8", errors="replace", **_get_subprocess_kwargs()
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "ExifTool failed.")

def _read_exif_data(file_path: str) -> dict:
    import json
    cmd = [*_get_exiftool_command(), "-charset", "UTF8", "-j", "-XMP:Title", "-IPTC:ObjectName", "-XMP:Description", "-IPTC:Caption-Abstract", "-XMP:Subject", "-IPTC:Keywords", file_path]
    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=str(BACKEND_DIR), **_get_subprocess_kwargs()
    )
    if result.returncode != 0 or not result.stdout.strip():
        return {"title": "", "description": "", "keywords": []}
    
    data = json.loads(result.stdout)[0]
    keywords = data.get("Subject") or data.get("Keywords") or []
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]
        
    return {
        "title": data.get("Title") or data.get("ObjectName") or "",
        "description": data.get("Description") or data.get("Caption-Abstract") or "",
        "keywords": keywords,
    }

def _resolve_local_file_path(file_record: LocalFile, db: Session) -> Path | None:
    path = Path(file_record.absolute_path)
    if path.exists(): return path
    return upload_storage.resolve_existing_path(file_record.absolute_path)

@router.get("/pick")
def pick_files():
    res = {"paths": []}
    def run_gui():
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        paths = filedialog.askopenfilenames(
            title="Select JPEG files",
            filetypes=[("JPEG files", "*.jpg *.jpeg")]
        )
        res["paths"] = list(paths)
        root.destroy()

    t = threading.Thread(target=run_gui)
    t.start()
    t.join()
    return {"paths": res["paths"]}


@router.post("/import", response_model=ImportResult, status_code=200)
def import_files(request: FileImportRequest, db: Session = Depends(get_db)) -> ImportResult:
    result = file_import_service.validate_and_import(request.paths, db)
    
    for file_resp in result.imported:
        record = db.query(LocalFile).filter(LocalFile.id == file_resp.id).first()
        if not record: continue
        
        try:
            exif = _read_exif_data(record.absolute_path)
            file_has_data = any([exif["title"], exif["description"], exif["keywords"]])
            
            db_meta = db.query(FileMetadata).filter(FileMetadata.file_id == record.id).first()
            
            if not db_meta:
                db.add(FileMetadata(file_id=record.id, title=exif.get("title", ""), description=exif.get("description", ""), keywords=exif.get("keywords", [])))
            else:
                db_has_data = any([db_meta.title, db_meta.description, db_meta.keywords])
                if file_has_data and not db_has_data:
                    db_meta.title, db_meta.description, db_meta.keywords = exif.get("title", ""), exif.get("description", ""), exif.get("keywords", [])
        except Exception as e:
            print(f"EXIF error: {e}")
            if not db.query(FileMetadata).filter(FileMetadata.file_id == record.id).first():
                db.add(FileMetadata(file_id=record.id, title="", description="", keywords=[]))
    db.commit()
    return result


# --- 3. ПРЯМИЙ ПЕРЕЗАПИС ПРИ ЕКСПОРТІ ---
@router.post("/export")
def export_files(request: ExportRequest, db: Session = Depends(get_db)):
    requested_file_ids = list(dict.fromkeys(request.file_ids))
    if not requested_file_ids:
        raise HTTPException(status_code=400, detail="No files selected.")

    files_to_export = db.query(LocalFile).filter(LocalFile.id.in_(requested_file_ids), LocalFile.status != "removed").all()
    success_count = 0
    errors = []

    for file_record in files_to_export:
        source_path = _resolve_local_file_path(file_record, db)
        if not source_path or not source_path.exists():
            errors.append(f"{file_record.filename}: File not found on disk.")
            continue

        meta = db.query(FileMetadata).filter(FileMetadata.file_id == file_record.id).first()
        title = meta.title if meta and meta.title else ""
        description = meta.description if meta and meta.description else ""
        keywords = meta.keywords if meta and meta.keywords else []

        try:
            # ЗАПИСУЄМО НАПРЯМУ В ОРИГІНАЛ
            _write_exif_data(str(source_path), title, description, keywords)
            success_count += 1
        except Exception as exc:
            errors.append(f"{file_record.filename}: {str(exc)}")

    if errors and success_count == 0:
        raise HTTPException(status_code=500, detail="Failed to save metadata: " + errors[0])

    return {"message": f"Saved metadata to {success_count} original file(s).", "errors": errors}


@router.get("/{file_id}/thumbnail", response_class=ThumbnailFileResponse)
def get_file_thumbnail(file_id: int, db: Session = Depends(get_db)) -> ThumbnailFileResponse:
    file_record = db.get(LocalFile, file_id)
    source_path = _resolve_local_file_path(file_record, db)
    thumbnail_path = preview_generator.generate(str(source_path))
    return ThumbnailFileResponse(thumbnail_path, media_type="image/jpeg")

@router.get("/", response_model=list[FileResponse])
def list_files(db: Session = Depends(get_db)) -> list[FileResponse]:
    return [FileResponse.model_validate(f) for f in db.query(LocalFile).filter(LocalFile.status != "removed").all()]

@router.delete("/{file_id}", status_code=204)
def delete_file_from_workspace(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(LocalFile).filter(LocalFile.id == file_id).first()
    if db_file:
        db_file.status = "removed"
        db.commit()
    return