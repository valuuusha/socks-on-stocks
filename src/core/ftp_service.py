"""FTP upload service with callback-based progress reporting."""

from __future__ import annotations

from ftplib import FTP, all_errors
from pathlib import Path
from typing import Callable

from models.entities import FTPProfile

StatusCallback = Callable[[Path, str], None]
ProgressCallback = Callable[[int, int], None]
FTP_EXCEPTIONS = all_errors + (OSError,)


class FTPService:
    """Uploads files to FTP endpoint using a selected profile."""

    def upload_files(
        self,
        profile: FTPProfile,
        files: list[Path],
        status_callback: StatusCallback,
        progress_callback: ProgressCallback,
    ) -> None:
        """Upload files and report per-file/overall progress."""
        total_files = len(files)
        completed = 0
        progress_callback(completed, total_files)

        if total_files == 0:
            return

        with FTP() as ftp:
            ftp.connect(profile.host, profile.port, timeout=30)
            ftp.login(profile.username, profile.password)
            ftp.set_pasv(profile.passive)
            if profile.remote_path:
                ftp.cwd(profile.remote_path)

            for file_path in files:
                try:
                    status_callback(file_path, "Uploading")
                    with file_path.open("rb") as file_obj:
                        ftp.storbinary(f"STOR {file_path.name}", file_obj)
                    status_callback(file_path, "Uploaded")
                except FTP_EXCEPTIONS as error:  # pragma: no cover - network side effect
                    status_callback(file_path, self._format_error_status(error))
                finally:
                    completed += 1
                    progress_callback(completed, total_files)

    @staticmethod
    def _format_error_status(error: Exception) -> str:
        message = str(error).lower()
        if "timed out" in message:
            return "Failed: connection timed out"
        if "530" in message:
            return "Failed: authentication error"
        return "Failed"
