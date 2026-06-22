import tempfile
import shutil
import ftplib
import ssl
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.database import get_db
from backend.models import FTPProfile, LocalFile, FileMetadata
from backend.services.ftp_service import encrypt_password, decrypt_password, test_connection
from backend.api.files import _write_exif_data, _resolve_local_file_path

router = APIRouter(prefix="/api/ftp", tags=["ftp"])

class FTPProfileBase(BaseModel):
    platform_name: str
    host: str
    port: int = 21
    login: str
    directory: Optional[str] = "/"

class FTPProfileCreate(FTPProfileBase):
    password: str

class FTPProfileResponse(FTPProfileBase):
    id: int
    
    class Config:
        from_attributes = True

class FTPTestRequest(BaseModel):
    platform_name: str
    host: str
    port: int = 21
    login: str
    password: str = ""
    directory: Optional[str] = "/"

class FTPUploadRequest(BaseModel):
    platform_name: str
    host: str
    port: int = 21
    login: str
    password: str = ""
    directory: str = "/"
    file_ids: List[int]

@router.get("", response_model=List[FTPProfileResponse])
def get_profiles(db: Session = Depends(get_db)):
    return db.query(FTPProfile).all()

@router.post("", response_model=FTPProfileResponse)
def create_or_update_profile(profile: FTPProfileCreate, db: Session = Depends(get_db)):
    db_profile = db.query(FTPProfile).filter(FTPProfile.platform_name == profile.platform_name).first()
    
    encrypted_pw = encrypt_password(profile.password)
    
    if db_profile:
        db_profile.host = profile.host
        db_profile.port = profile.port
        db_profile.login = profile.login
        db_profile.encrypted_password = encrypted_pw
        db_profile.directory = profile.directory
    else:
        db_profile = FTPProfile(
            platform_name=profile.platform_name,
            host=profile.host,
            port=profile.port,
            login=profile.login,
            encrypted_password=encrypted_pw,
            directory=profile.directory
        )
        db.add(db_profile)
        
    db.commit()
    db.refresh(db_profile)
    return db_profile

@router.put("/{profile_id}", response_model=FTPProfileResponse)
def update_profile(profile_id: int, profile: FTPProfileCreate, db: Session = Depends(get_db)):
    db_profile = db.query(FTPProfile).filter(FTPProfile.id == profile_id).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    db_profile.platform_name = profile.platform_name
    db_profile.host = profile.host
    db_profile.port = profile.port
    db_profile.login = profile.login
    db_profile.directory = profile.directory
    if profile.password:
        db_profile.encrypted_password = encrypt_password(profile.password)

    db.commit()
    db.refresh(db_profile)
    return db_profile

@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(FTPProfile).filter(FTPProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    db.delete(profile)
    db.commit()
    return

@router.post("/test")
def test_ftp(request: FTPTestRequest, db: Session = Depends(get_db)):
    password = request.password
    if not password:
        profile = db.query(FTPProfile).filter(FTPProfile.platform_name == request.platform_name).first()
        if profile and profile.encrypted_password:
            password = decrypt_password(profile.encrypted_password)

    success, message = test_connection(
        request.host, 
        request.port, 
        request.login, 
        password, 
        request.directory
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

@router.post("/upload")
def upload_files_to_ftp(request: FTPUploadRequest, db: Session = Depends(get_db)):
    files_to_upload = db.query(LocalFile).filter(LocalFile.id.in_(request.file_ids), LocalFile.status != "removed").all()
    if not files_to_upload:
        raise HTTPException(status_code=400, detail="No files found to upload.")

    success_count = 0
    errors = []

    password = request.password
    if not password:
        profile = db.query(FTPProfile).filter(FTPProfile.platform_name == request.platform_name).first()
        if profile and profile.encrypted_password:
            password = decrypt_password(profile.encrypted_password)

    try:
        try:
            context = ssl._create_unverified_context()
            ftp = ftplib.FTP_TLS(context=context)
            ftp.connect(request.host, request.port, timeout=15)
            ftp.login(request.login, password)
            ftp.prot_p()
        except (ssl.SSLError, ftplib.error_perm) as e:
            if "534" in str(e):
                    raise Exception(f"FTP Error: {str(e)}")
            
            ftp = ftplib.FTP()
            ftp.connect(request.host, request.port, timeout=15)
            ftp.login(request.login, password)

        if request.directory and request.directory.strip() not in ["", "/"]:
            ftp.cwd(request.directory)

        with tempfile.TemporaryDirectory() as temp_dir:
            for f in files_to_upload:
                source_path = _resolve_local_file_path(f, db)
                if not source_path:
                    errors.append(f"{f.filename}: File missing on disk.")
                    continue

                meta = db.query(FileMetadata).filter(FileMetadata.file_id == f.id).first()
                title = meta.title if meta and meta.title else ""
                desc = meta.description if meta and meta.description else ""
                kw = meta.keywords if meta and meta.keywords else []

                temp_file = Path(temp_dir) / f.filename
                shutil.copy2(source_path, temp_file)
                try:
                    _write_exif_data(str(temp_file), title, desc, kw)
                except Exception as e:
                    errors.append(f"{f.filename}: Failed to write EXIF metadata.")
                    continue

                try:
                    with open(temp_file, "rb") as file_obj:
                        ftp.storbinary(f"STOR {f.filename}", file_obj)
                    success_count += 1
                except Exception as e:
                    errors.append(f"{f.filename}: FTP Error - {str(e)}")

        ftp.quit()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if errors and success_count == 0:
        raise HTTPException(status_code=500, detail=errors[0])

    return {
        "success_count": success_count,
        "total": len(files_to_upload),
        "errors": errors
    }