"""SQLite persistence for metadata history and FTP profiles."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from models.entities import FTPProfile, ImageMetadata


class Database:
    """Database facade for app persistence operations."""

    def __init__(self, db_path: Path) -> None:
        self._conn = sqlite3.connect(db_path)
        self._conn.row_factory = sqlite3.Row
        self._initialize_schema()

    def close(self) -> None:
        """Close active DB connection."""
        self._conn.close()

    def _initialize_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS metadata_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                md5_hash TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                keywords TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(filename, md5_hash)
            );

            CREATE TABLE IF NOT EXISTS ftp_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                host TEXT NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 21,
                remote_path TEXT NOT NULL DEFAULT '/',
                passive INTEGER NOT NULL DEFAULT 1
            );
            """
        )
        self._conn.commit()

    def upsert_metadata(self, filename: str, md5_hash: str, metadata: ImageMetadata) -> None:
        """Insert or update metadata for a file identified by filename + MD5."""
        self._conn.execute(
            """
            INSERT INTO metadata_history (filename, md5_hash, title, description, keywords, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(filename, md5_hash) DO UPDATE SET
                title=excluded.title,
                description=excluded.description,
                keywords=excluded.keywords,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                filename,
                md5_hash,
                metadata.title,
                metadata.description,
                json.dumps(metadata.keywords),
            ),
        )
        self._conn.commit()

    def get_metadata(self, filename: str, md5_hash: str) -> ImageMetadata | None:
        """Return metadata for exact filename + MD5 match if available."""
        row = self._conn.execute(
            "SELECT title, description, keywords FROM metadata_history WHERE filename=? AND md5_hash=?",
            (filename, md5_hash),
        ).fetchone()
        if row is None:
            return None
        return ImageMetadata(
            title=row["title"],
            description=row["description"],
            keywords=self._decode_keywords(row["keywords"]),
        )

    def find_metadata_conflict(self, filename: str, md5_hash: str) -> ImageMetadata | None:
        """Find most recent metadata for same filename but different MD5 hash."""
        row = self._conn.execute(
            """
            SELECT title, description, keywords
            FROM metadata_history
            WHERE filename = ? AND md5_hash != ?
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            """,
            (filename, md5_hash),
        ).fetchone()
        if row is None:
            return None
        return ImageMetadata(
            title=row["title"],
            description=row["description"],
            keywords=self._decode_keywords(row["keywords"]),
        )

    def save_ftp_profile(self, profile: FTPProfile) -> None:
        """Insert or update an FTP profile by unique profile name."""
        self._conn.execute(
            """
            INSERT INTO ftp_profiles (name, host, username, password, port, remote_path, passive)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                host=excluded.host,
                username=excluded.username,
                password=excluded.password,
                port=excluded.port,
                remote_path=excluded.remote_path,
                passive=excluded.passive
            """,
            (
                profile.name,
                profile.host,
                profile.username,
                profile.password,
                profile.port,
                profile.remote_path,
                int(profile.passive),
            ),
        )
        self._conn.commit()

    def list_ftp_profiles(self) -> list[FTPProfile]:
        """Return all stored FTP profiles sorted by name."""
        rows = self._conn.execute(
            """
            SELECT name, host, username, password, port, remote_path, passive
            FROM ftp_profiles
            ORDER BY name ASC
            """
        ).fetchall()
        return [
            FTPProfile(
                name=row["name"],
                host=row["host"],
                username=row["username"],
                password=row["password"],
                port=int(row["port"]),
                remote_path=row["remote_path"],
                passive=bool(row["passive"]),
            )
            for row in rows
        ]

    @staticmethod
    def _decode_keywords(raw: str) -> list[str]:
        values = json.loads(raw)
        if not isinstance(values, list):
            return []
        return [str(value) for value in values]
