from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.database import get_db
from backend.models import FTPProfile
from backend.services.ftp_service import encrypt_password, decrypt_password, test_connection

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
    host: str
    port: int = 21
    login: str
    password: str
    directory: Optional[str] = "/"

@router.get("/", response_model=List[FTPProfileResponse])
def get_profiles(db: Session = Depends(get_db)):
    return db.query(FTPProfile).all()

@router.post("/", response_model=FTPProfileResponse)
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

@router.post("/test")
def test_ftp(request: FTPTestRequest):
    success, message = test_connection(
        request.host, 
        request.port, 
        request.login, 
        request.password, 
        request.directory
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}