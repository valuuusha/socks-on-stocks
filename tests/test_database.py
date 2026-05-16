"""Tests for SQLite persistence layer."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from core.database import Database
from models.entities import FTPProfile, ImageMetadata


class DatabaseTests(unittest.TestCase):
    """Validate database schema-backed operations."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "test.db"
        self.database = Database(self.db_path)

    def tearDown(self) -> None:
        self.database.close()
        self.tmp_dir.cleanup()

    def test_metadata_conflict_returns_latest_other_hash(self) -> None:
        self.database.upsert_metadata(
            "photo.jpg",
            "hash-a",
            ImageMetadata(title="Old", description="Old desc", keywords=["old"]),
        )
        self.database.upsert_metadata(
            "photo.jpg",
            "hash-b",
            ImageMetadata(title="New", description="New desc", keywords=["new", "latest"]),
        )

        exact = self.database.get_metadata("photo.jpg", "hash-b")
        self.assertIsNotNone(exact)
        self.assertEqual("New", exact.title)

        conflict = self.database.find_metadata_conflict("photo.jpg", "hash-c")
        self.assertIsNotNone(conflict)
        self.assertEqual("New", conflict.title)
        self.assertEqual(["new", "latest"], conflict.keywords)

    def test_save_and_list_ftp_profiles(self) -> None:
        self.database.save_ftp_profile(
            FTPProfile(
                name="main",
                host="ftp.example.com",
                username="uploader",
                password="secret",
                port=2121,
                remote_path="/uploads",
                passive=False,
            )
        )

        profiles = self.database.list_ftp_profiles()
        self.assertEqual(1, len(profiles))
        self.assertEqual("main", profiles[0].name)
        self.assertEqual(2121, profiles[0].port)
        self.assertFalse(profiles[0].passive)


if __name__ == "__main__":
    unittest.main()
