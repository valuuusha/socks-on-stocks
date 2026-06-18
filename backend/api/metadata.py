from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import FileMetadata, LocalFile
from backend.schemas import MetadataUpdate, MetadataResponse
from backend.api.files import _read_exif_data, _resolve_local_file_path

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

@router.get("/{file_id}/conflict")
def check_metadata_conflict(file_id: int, db: Session = Depends(get_db)):
    file_record = db.query(LocalFile).filter(LocalFile.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    source_path = _resolve_local_file_path(file_record, db)
    if db.dirty:
        db.commit()
    file_meta = (
        _read_exif_data(str(source_path))
        if source_path else {"title": "", "description": "", "keywords": []}
    )

    db_row = db.query(FileMetadata).filter(FileMetadata.file_id == file_id).first()
    db_meta = {
        "title": db_row.title if db_row else "",
        "description": db_row.description if db_row else "",
        "keywords": db_row.keywords if db_row else [],
    }

    file_has = any([file_meta["title"], file_meta["description"], file_meta["keywords"]])
    db_has = any([db_meta["title"], db_meta["description"], db_meta["keywords"]])

    if not file_has and not db_has:
        action = "empty"
    elif file_has and not db_has:
        action = "use_file"
    elif not file_has and db_has:
        action = "use_db"
    elif file_meta == db_meta:
        action = "same"
    else:
        action = "conflict"

    return {"action": action, "file": file_meta, "db": db_meta}