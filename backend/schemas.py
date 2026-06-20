import re
from pydantic import BaseModel, StrictStr, field_validator, Field
from typing import Optional, List

FORBIDDEN_CHARS = re.compile(r"[&#@%!?/\\*]")

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

class ExportRequest(BaseModel):
    file_ids: List[int]

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
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    keywords: Optional[List[str]] = Field(None, max_length=50)

    @field_validator("description", "title")
    @classmethod
    def check_forbidden_chars(cls, value: Optional[str]) -> Optional[str]:
        if value and FORBIDDEN_CHARS.search(value):
            raise ValueError("Contains forbidden special characters (&, #, @, %, !, ?, /, \\, *)")
        return value

    @field_validator("keywords")
    @classmethod
    def check_keywords(cls, keywords: Optional[List[str]]) -> Optional[List[str]]:
        if not keywords:
            return keywords
        for kw in keywords:
            if len(kw) > 50:
                raise ValueError(f"Keyword '{kw}' is too long (max 50 chars)")
            if FORBIDDEN_CHARS.search(kw):
                raise ValueError(f"Keyword '{kw}' contains forbidden characters")
        return keywords

class MetadataResponse(BaseModel):
    """Data that we provide to the frontend to fill in the fields."""
    file_id: int
    title: str
    description: str
    keywords: List[str]
    
    model_config = {"from_attributes": True}