"""Main window layout and UI orchestration for MVP workflows."""

from __future__ import annotations

from pathlib import Path

from PyQt6.QtCore import QSize, Qt
from PyQt6.QtGui import QIcon, QPixmap
from PyQt6.QtWidgets import (
    QApplication,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QComboBox,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from core.database import Database
from core.file_service import calculate_md5, is_image_file
from core.ftp_service import FTPService
from core.metadata_service import MetadataService
from models.entities import FTPProfile, ImageMetadata, ImportedImage
from ui.conflict_dialog import ConflictResolutionDialog


class MainWindow(QMainWindow):
    """Main desktop application window."""

    def __init__(self, database: Database, metadata_service: MetadataService, ftp_service: FTPService) -> None:
        super().__init__()
        self.database = database
        self.metadata_service = metadata_service
        self.ftp_service = ftp_service
        self.images: dict[str, ImportedImage] = {}

        self.setWindowTitle("Socks on Stocks")
        self.resize(1200, 760)
        self._setup_ui()
        self._reload_ftp_profiles()

    def _setup_ui(self) -> None:
        root = QWidget(self)
        root_layout = QVBoxLayout()
        root.setLayout(root_layout)
        self.setCentralWidget(root)

        toolbar = QHBoxLayout()
        import_button = QPushButton("Import Images")
        import_button.clicked.connect(self.import_images)
        toolbar.addWidget(import_button)
        toolbar.addStretch()
        root_layout.addLayout(toolbar)

        splitter = QSplitter()
        root_layout.addWidget(splitter)

        left_panel = QWidget()
        left_layout = QVBoxLayout()
        left_panel.setLayout(left_layout)
        left_layout.addWidget(QLabel("Image Gallery"))

        self.gallery = QListWidget()
        self.gallery.setViewMode(QListWidget.ViewMode.IconMode)
        self.gallery.setIconSize(QSize(128, 128))
        self.gallery.setResizeMode(QListWidget.ResizeMode.Adjust)
        self.gallery.setSelectionMode(QListWidget.SelectionMode.ExtendedSelection)
        self.gallery.currentItemChanged.connect(self._on_gallery_selection_changed)
        left_layout.addWidget(self.gallery)
        splitter.addWidget(left_panel)

        right_panel = QWidget()
        right_layout = QVBoxLayout()
        right_panel.setLayout(right_layout)
        splitter.addWidget(right_panel)

        right_layout.addWidget(QLabel("Metadata Editor"))
        metadata_form = QFormLayout()
        self.title_input = QLineEdit()
        self.description_input = QTextEdit()
        self.keywords_input = QLineEdit()
        metadata_form.addRow("Title", self.title_input)
        metadata_form.addRow("Description", self.description_input)
        metadata_form.addRow("Keywords (comma-separated)", self.keywords_input)
        right_layout.addLayout(metadata_form)

        save_metadata_button = QPushButton("Save Metadata")
        save_metadata_button.clicked.connect(self.save_metadata)
        right_layout.addWidget(save_metadata_button)

        right_layout.addWidget(QLabel("FTP Manager"))
        ftp_controls = QHBoxLayout()
        self.ftp_profile_selector = QComboBox()
        self.ftp_profile_selector.setEditable(True)
        self.ftp_profile_selector.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        ftp_controls.addWidget(self.ftp_profile_selector)
        add_profile_button = QPushButton("Save FTP Profile")
        add_profile_button.clicked.connect(self.add_or_update_ftp_profile)
        ftp_controls.addWidget(add_profile_button)
        upload_button = QPushButton("Upload Selected")
        upload_button.clicked.connect(self.upload_selected)
        ftp_controls.addWidget(upload_button)
        right_layout.addLayout(ftp_controls)

        self.upload_status_table = QTableWidget(0, 2)
        self.upload_status_table.setHorizontalHeaderLabels(["File", "Status"])
        right_layout.addWidget(self.upload_status_table)

        self.upload_progress = QProgressBar()
        self.upload_progress.setMinimum(0)
        self.upload_progress.setMaximum(100)
        right_layout.addWidget(self.upload_progress)

    def import_images(self) -> None:
        """Import image files and populate gallery."""
        files, _ = QFileDialog.getOpenFileNames(self, "Select images", "", "Images (*.jpg *.jpeg *.png)")
        for file_path in files:
            path = Path(file_path)
            if not is_image_file(path):
                continue

            md5_hash = calculate_md5(path)
            metadata = self.metadata_service.read_metadata(path)

            conflict_metadata = self.database.find_metadata_conflict(path.name, md5_hash)
            if conflict_metadata is not None:
                dialog = ConflictResolutionDialog(path.name, parent=self)
                if dialog.exec() and dialog.choice == ConflictResolutionDialog.USE_DATABASE:
                    metadata = conflict_metadata

            self.database.upsert_metadata(path.name, md5_hash, metadata)
            image = ImportedImage(path=path, md5_hash=md5_hash, metadata=metadata)
            self.images[str(path)] = image
            self._upsert_gallery_item(image)

    def _upsert_gallery_item(self, image: ImportedImage) -> None:
        for index in range(self.gallery.count()):
            item = self.gallery.item(index)
            if item.data(Qt.ItemDataRole.UserRole) == str(image.path):
                item.setText(image.filename)
                item.setIcon(self._create_thumbnail_icon(image.path))
                return

        item = QListWidgetItem(image.filename)
        item.setData(Qt.ItemDataRole.UserRole, str(image.path))
        item.setIcon(self._create_thumbnail_icon(image.path))
        self.gallery.addItem(item)

    @staticmethod
    def _create_thumbnail_icon(path: Path) -> QIcon:
        pixmap = QPixmap(str(path))
        if pixmap.isNull():
            return QIcon()
        return QIcon(pixmap.scaled(128, 128))

    def _on_gallery_selection_changed(self, current: QListWidgetItem | None) -> None:
        if current is None:
            return
        image = self.images.get(current.data(Qt.ItemDataRole.UserRole))
        if image is None:
            return
        self._fill_metadata_form(image.metadata)

    def _fill_metadata_form(self, metadata: ImageMetadata) -> None:
        self.title_input.setText(metadata.title)
        self.description_input.setPlainText(metadata.description)
        self.keywords_input.setText(", ".join(metadata.keywords))

    def _read_metadata_form(self) -> ImageMetadata:
        keywords = [part.strip() for part in self.keywords_input.text().split(",") if part.strip()]
        return ImageMetadata(
            title=self.title_input.text().strip(),
            description=self.description_input.toPlainText().strip(),
            keywords=keywords,
        )

    def save_metadata(self) -> None:
        """Save edited metadata to selected files and database history."""
        selected_items = self.gallery.selectedItems()
        if not selected_items:
            QMessageBox.information(self, "No selection", "Select at least one image.")
            return

        metadata = self._read_metadata_form()
        for item in selected_items:
            image = self.images.get(item.data(Qt.ItemDataRole.UserRole))
            if image is None:
                continue
            self.metadata_service.write_metadata(image.path, metadata)
            image.metadata = metadata
            self.database.upsert_metadata(image.filename, image.md5_hash, metadata)

        QMessageBox.information(self, "Metadata saved", "Metadata updated for selected file(s).")

    def add_or_update_ftp_profile(self) -> None:
        """Prompt for FTP profile details and persist the profile."""
        profile_name = self.ftp_profile_selector.currentText().strip()
        if not profile_name:
            QMessageBox.warning(self, "Missing name", "Provide a profile name.")
            return

        host, ok = QInputDialog.getText(self, "FTP Host", "Host:")
        if not ok or not host.strip():
            return
        username, ok = QInputDialog.getText(self, "FTP Login", "Username:")
        if not ok:
            return
        password, ok = QInputDialog.getText(self, "FTP Login", "Password:")
        if not ok:
            return
        remote_path, ok = QInputDialog.getText(self, "FTP Remote Path", "Remote path:", text="/")
        if not ok:
            return

        profile = FTPProfile(
            name=profile_name,
            host=host.strip(),
            username=username.strip(),
            password=password,
            remote_path=remote_path.strip() or "/",
        )
        self.database.save_ftp_profile(profile)
        self._reload_ftp_profiles()
        self.ftp_profile_selector.setCurrentText(profile_name)
        QMessageBox.information(self, "Saved", f"FTP profile '{profile_name}' saved.")

    def _reload_ftp_profiles(self) -> None:
        profiles = self.database.list_ftp_profiles()
        current_name = self.ftp_profile_selector.currentText()
        self.ftp_profile_selector.blockSignals(True)
        self.ftp_profile_selector.clear()
        self.ftp_profile_selector.addItems([profile.name for profile in profiles])
        self.ftp_profile_selector.blockSignals(False)
        if current_name:
            self.ftp_profile_selector.setCurrentText(current_name)
        elif profiles:
            self.ftp_profile_selector.setCurrentText(profiles[0].name)

    def upload_selected(self) -> None:
        """Upload selected files using selected FTP profile name."""
        selected_items = self.gallery.selectedItems()
        if not selected_items:
            QMessageBox.warning(self, "No selection", "Select images to upload.")
            return

        profile_name = self.ftp_profile_selector.currentText().strip()
        profile = next((item for item in self.database.list_ftp_profiles() if item.name == profile_name), None)
        if profile is None:
            QMessageBox.warning(self, "Profile not found", "Save and select a valid FTP profile name.")
            return

        files = [Path(item.data(Qt.ItemDataRole.UserRole)) for item in selected_items]
        self._prepare_upload_rows(files)

        def status_callback(file_path: Path, status: str) -> None:
            self._update_upload_status(file_path.name, status)
            QApplication.processEvents()

        def progress_callback(done: int, total: int) -> None:
            value = int((done / total) * 100) if total else 0
            self.upload_progress.setValue(value)
            QApplication.processEvents()

        self.ftp_service.upload_files(profile, files, status_callback, progress_callback)
        QMessageBox.information(self, "Upload completed", "Upload flow finished.")

    def _prepare_upload_rows(self, files: list[Path]) -> None:
        self.upload_status_table.setRowCount(len(files))
        for row, path in enumerate(files):
            self.upload_status_table.setItem(row, 0, QTableWidgetItem(path.name))
            self.upload_status_table.setItem(row, 1, QTableWidgetItem("Pending"))
        self.upload_progress.setValue(0)

    def _update_upload_status(self, filename: str, status: str) -> None:
        for row in range(self.upload_status_table.rowCount()):
            file_item = self.upload_status_table.item(row, 0)
            if file_item and file_item.text() == filename:
                self.upload_status_table.setItem(row, 1, QTableWidgetItem(status))
                return
