from sqlalchemy import Column, Float, Integer, String
from backend.database import Base


class LocalFile(Base):
    """Represents a JPEG file imported into the workspace."""

    __tablename__ = "local_files"

    # primary key
    id: int = Column(Integer, primary_key=True, index=True)

    # file identity
    filename: str = Column(String, nullable=False)

    absolute_path: str = Column(String, nullable=False, unique=True)

    # file attributes
    file_size_kb: float = Column(Float, nullable=False)

    file_format: str = Column(String, nullable=False, default="JPEG")

    # workflow status
    status: str = Column(String, nullable=False, default="imported")
    
    """
    Lifecycle states:
      'imported' - file just added, metadata not yet edited
      'ready' - metadata filled in, file is ready to upload
      'invalid' - file failed validation
    """