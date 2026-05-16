# socks-on-stocks

Cross-platform desktop scaffold (Windows/macOS) for stock photo contributors.

## Tech stack

- **GUI:** PyQt6
- **Database:** SQLite (`sqlite3`)
- **Metadata:** ExifTool via subprocess wrapper and `pyexiftool`
- **FTP:** `ftplib`
- **Packaging:** PyInstaller

## Project structure

```text
/src
  main.py
  /ui
  /core
  /models
/tests
requirements.txt
README.md
```

## MVP scaffolded features

- Image Gallery import for JPEG/PNG with thumbnail grid
- Metadata editor for Title, Description, Keywords
- SQLite metadata history with filename + MD5 conflict lookup
- Conflict dialog on re-import:
  - Keep file metadata
  - Use database metadata
- FTP profiles and selected-file upload with per-file status and overall progress

## Security note

For this MVP scaffold, FTP profile passwords are stored in the local SQLite database as plain text to keep implementation simple. Use only on trusted local machines and plan secure credential storage (e.g., OS keychain integration) before production use.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

## Tests

```bash
python -m unittest discover -s tests -p "test*.py"
```
