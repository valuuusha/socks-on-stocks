from sqlalchemy import Column, Float, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base


class LocalFile(Base):
    """Represents a JPEG file imported into the workspace."""

    __tablename__ = "local_files"

    id: int = Column(Integer, primary_key=True, index=True)
    filename: str = Column(String, nullable=False)
    absolute_path: str = Column(String, nullable=False, unique=True)
    file_size_kb: float = Column(Float, nullable=False)
    file_format: str = Column(String, nullable=False, default="JPEG")
    status: str = Column(String, nullable=False, default="imported")
    """
    Lifecycle states:
      'imported' - file just added, metadata not yet edited
      'ready' - metadata filled in, file is ready to upload
      'invalid' - file failed validation
    """

class FileMetadata(Base):
    """Stores user-entered metadata for a specific file."""
    __tablename__ = "file_metadata"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("local_files.id", ondelete="CASCADE"), unique=True)
    title = Column(String, nullable=True, default="")
    description = Column(Text, nullable=True, default="")
    keywords = Column(JSON, nullable=False, default=list)
    
    file = relationship("LocalFile", backref="metadata_record")

class FTPProfile(Base):
    __tablename__ = "ftp_profiles"

    id = Column(Integer, primary_key=True, index=True)
    platform_name = Column(String, index=True)
    host = Column(String)
    port = Column(Integer, default=21)
    login = Column(String)
    encrypted_password = Column(String)
    directory = Column(String, default="/")