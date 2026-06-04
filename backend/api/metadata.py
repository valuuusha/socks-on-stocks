from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import FileMetadata, LocalFile
from backend.schemas import MetadataUpdate, MetadataResponse

router = APIRouter(prefix="/api/metadata", tags=["Metadata"])

@router.get("/{file_id}", response_model=MetadataResponse)
def get_metadata(file_id: int, db: Session = Depends(get_db)):
    """Gets the file metadata. If it doesn't exist in the database yet, creates an empty one."""
    if not db.query(LocalFile).filter(LocalFile.id == file_id).first():
        raise HTTPException(status_code=404, detail="File not found")

    meta = db.query(FileMetadata).filter(FileMetadata.file_id == file_id).first()
    
    if not meta:
        meta = FileMetadata(file_id=file_id, title="", description="")
        db.add(meta)
        db.commit()
        db.refresh(meta)
        
    return meta

@router.put("/{file_id}", response_model=MetadataResponse)
def update_metadata(file_id: int, data: MetadataUpdate, db: Session = Depends(get_db)):
    """Updates the title and/or description of the file."""
    meta = db.query(FileMetadata).filter(FileMetadata.file_id == file_id).first()
    
    if not meta:
        meta = FileMetadata(file_id=file_id, title="", description="")
        db.add(meta)

    if data.title is not None:
        meta.title = data.title
    if data.description is not None:
        meta.description = data.description
    if data.keywords is not None:
        meta.keywords = data.keywords
        
    db.commit()
    db.refresh(meta)
    return meta