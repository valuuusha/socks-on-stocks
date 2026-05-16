"""Application entrypoint."""

from __future__ import annotations

import sys
from pathlib import Path

from PyQt6.QtWidgets import QApplication

from core.database import Database
from core.ftp_service import FTPService
from core.metadata_service import MetadataService
from ui.main_window import MainWindow


def main() -> int:
    """Run desktop application."""
    app = QApplication(sys.argv)
    db_path = Path(__file__).resolve().parent / "socks_on_stocks.db"
    database = Database(db_path)
    window = MainWindow(database=database, metadata_service=MetadataService(), ftp_service=FTPService())
    window.show()
    exit_code = app.exec()
    database.close()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
