from pydantic import BaseModel, StrictStr, field_validator
from typing import Optional, List

class FileImportRequest(BaseModel):
    """
    Payload sent by the frontend when the user picks files.

    Example JSON body:
        { "paths": ["/Users/anna/photos/cat.jpg", "/Users/anna/photos/dog.jpeg"] }
    """

    paths: list[StrictStr]
    """Non-empty list of absolute file paths chosen by the user."""

    @field_validator("paths")
    @classmethod
    def must_not_be_empty(cls, v: list[StrictStr]) -> list[StrictStr]:
        if not v:
            raise ValueError("The paths list must contain at least one file path.")
        return v


class FileResponse(BaseModel):
    """
    Represents a successfully imported file as returned to the frontend.
    Only exposes the fields the UI actually needs - never leaks internal DB state.
    """

    id: int
    filename: str
    absolute_path: str
    file_size_kb: float
    file_format: str
    status: str

    model_config = {"from_attributes": True}


class RejectedFile(BaseModel):
    """Describes a single file that could not be imported and the reason why."""

    path: str
    reason: str
    """Human-readable message shown in the frontend toast notification."""


class ImportResult(BaseModel):
    """Returned by POST /api/files/import after processing the whole batch."""

    imported: list[FileResponse]
    """Files that passed validation and were saved to the DB."""

    rejected: list[RejectedFile]
    """Files that failed validation - not added to the workspace."""

    total: int
    """Total number of paths that were submitted."""

    @property
    def summary(self) -> str:
        return f"Imported {len(self.imported)} of {self.total} files."

class MetadataUpdate(BaseModel):
    """Data that will come from the frontend when editing (onBlur)."""
    title: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[List[str]] = None

class MetadataResponse(BaseModel):
    """Data that we provide to the frontend to fill in the fields."""
    file_id: int
    title: str
    description: str
    keywords: List[str]
    
    model_config = {"from_attributes": True}