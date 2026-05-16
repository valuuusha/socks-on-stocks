"""Metadata conflict resolution dialog."""

from __future__ import annotations

from PyQt6.QtWidgets import QDialog, QDialogButtonBox, QLabel, QVBoxLayout


class ConflictResolutionDialog(QDialog):
    """Dialog that asks which metadata source to keep on re-import conflict."""

    KEEP_FILE = "file"
    USE_DATABASE = "database"

    def __init__(self, filename: str, parent=None) -> None:
        super().__init__(parent)
        self.choice = self.KEEP_FILE
        self.setWindowTitle("Metadata Conflict")

        message = QLabel(
            f"Metadata conflict detected for '{filename}'.\n\n"
            "Choose which metadata to apply:"
        )
        buttons = QDialogButtonBox()
        keep_file_button = buttons.addButton("Keep file metadata", QDialogButtonBox.ButtonRole.AcceptRole)
        use_db_button = buttons.addButton("Use database metadata", QDialogButtonBox.ButtonRole.DestructiveRole)
        buttons.rejected.connect(self.reject)

        keep_file_button.clicked.connect(self._set_file_choice)
        use_db_button.clicked.connect(self._set_database_choice)

        layout = QVBoxLayout()
        layout.addWidget(message)
        layout.addWidget(buttons)
        self.setLayout(layout)

    def _set_file_choice(self) -> None:
        self.choice = self.KEEP_FILE
        self.accept()

    def _set_database_choice(self) -> None:
        self.choice = self.USE_DATABASE
        self.accept()
