from pydantic import BaseModel, field_validator


class FileImportRequest(BaseModel):
    """
    Payload sent by the frontend when the user picks files.

    Example JSON body:
        { "paths": ["/Users/anna/photos/cat.jpg", "/Users/anna/photos/dog.jpeg"] }
    """

    paths: list[str]
    """Non-empty list of absolute file paths chosen by the user."""

    @field_validator("paths")
    @classmethod
    def must_not_be_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("The paths list must contain at least one file path.")
        return v


class FileResponse(BaseModel):
    """
    Represents a successfully imported file as returned to the frontend.
    Only exposes the fields the UI actually needs — never leaks internal DB state.
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
    """Files that failed validation — NOT added to the workspace."""

    total: int
    """Total number of paths that were submitted."""

    @property
    def summary(self) -> str:
        return f"Imported {len(self.imported)} of {self.total} files."