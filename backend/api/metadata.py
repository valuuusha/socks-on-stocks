from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import FileMetadata, LocalFile
from backend.schemas import MetadataUpdate, MetadataResponse
from backend.api.files import _read_exif_data, _resolve_local_file_path

router = APIRouter(prefix="/api/metadata", tags=["Metadata"])

@router.get("/sync")
def sync_metadata(db: Session = Depends(get_db)):
    files = db.query(LocalFile).filter(LocalFile.status != "removed").all()
    conflicts = []
    
    for f in files:
        source_path = _resolve_local_file_path(f, db)
        if not source_path or not source_path.exists():
            continue
            
        file_meta = _read_exif_data(str(source_path))
        db_row = db.query(FileMetadata).filter(FileMetadata.file_id == f.id).first()
        
        if not db_row:
            db_row = FileMetadata(file_id=f.id, title="", description="", keywords=[])
            db.add(db_row)
            db.commit()
            db.refresh(db_row)
            
        db_meta = {
            "title": db_row.title or "",
            "description": db_row.description or "",
            "keywords": db_row.keywords or []
        }
        
        file_has = any([file_meta["title"], file_meta["description"], file_meta["keywords"]])
        db_has = any([db_meta["title"], db_meta["description"], db_meta["keywords"]])
        
        if file_has and not db_has:
            db_row.title = file_meta["title"]
            db_row.description = file_meta["description"]
            db_row.keywords = file_meta["keywords"]
            db.commit()
            
        elif not file_has:
            pass
            
        elif file_has and db_has:
            f_kw = sorted([k.lower() for k in file_meta["keywords"]])
            d_kw = sorted([k.lower() for k in db_meta["keywords"]])
            if file_meta["title"] != db_meta["title"] or \
               file_meta["description"] != db_meta["description"] or \
               f_kw != d_kw:
                conflicts.append({
                    "file_id": f.id,
                    "filename": f.filename,
                    "file_meta": file_meta,
                    "db_meta": db_meta
                })
                
    return conflicts

@router.get("/{file_id}", response_model=MetadataResponse)
def get_metadata(file_id: int, db: Session = Depends(get_db)):
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
    meta = db.query(FileMetadata).filter(FileMetadata.file_id == file_id).first()
    if not meta:
        meta = FileMetadata(file_id=file_id, title="", description="")
        db.add(meta)

    if data.title is not None: meta.title = data.title
    if data.description is not None: meta.description = data.description
    if data.keywords is not None: meta.keywords = data.keywords
        
    db.commit()
    db.refresh(meta)
    return meta