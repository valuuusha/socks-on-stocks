# Socks on Stocks

A cross-platform desktop app for stock photo contributors.
Manage metadata (EXIF/IPTC/XMP) and upload files to stock platforms via FTP - all in one tool.

## Features

- Import JPEG files and manage them in a workspace
- Edit metadata: title, description, keywords
- Write metadata directly to JPEG files
- FTP upload to multiple stock platforms
- Local SQLite database with CSV export/import

## Tech Stack

- Python 3.11+
- FastAPI
- SQLite + SQLAlchemy
- Pillow
- React + TypeScript
- Vite
- Zustand

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+

### Backend

```bash
git clone https://github.com/valuuusha/socks-on-stocks.git
cd socks-on-stocks

python -m venv venv
venv\Scripts\activate # Windows
# source venv/bin/activate # macOS / Linux

pip install -r requirements.txt
uvicorn backend.main:app --reload
```

API runs at `http://127.0.0.1:8000`
Swagger docs at `http://127.0.0.1:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173`

## Project Structure

```text
socks-on-stocks/
|-- backend/                  # Python FastAPI backend
|   |-- api/
|   |   |-- files.py          # File import & workspace endpoints
|   |   `-- metadata.py       # Metadata read/write endpoints
|   |-- services/
|   |   |-- file_service.py   # JPEG validation & import logic
|   |   |-- thumbnail_service.py
|   |   `-- upload_storage_service.py
|   |-- models.py             # SQLAlchemy DB models
|   |-- schemas.py            # Pydantic request/response schemas
|   |-- database.py           # SQLite connection setup
|   `-- main.py               # FastAPI app entry point
|-- frontend/                 # React + TypeScript frontend
|   `-- src/
|       |-- components/       # UI components
|       |-- store/            # Zustand global state
|       `-- api/              # API client functions
|-- docs/                     # Project documentation
|-- tests/                    # Tests
`-- requirements.txt
```

## Team

| Role | Developer |
|------|-----------|
| Frontend Core | [Veronika Zinchenko](https://github.com/heloveroo) |
| Frontend UI/UX | [Anastasia Kovtoniuk](https://github.com/anastasiakovtoniuk) |
| Backend API | [Valentyna Dermenzhy](https://github.com/valuuusha) |
| Backend Validator | [Anna Romanchuk](https://github.com/AnnaRomanchuk) |
| Backend Media | [Anton Pihuliak](https://github.com/MaFiN1337) |