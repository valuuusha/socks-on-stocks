# Socks on Stocks

A cross-platform desktop app for stock photo contributors.  
Manage metadata (EXIF/IPTC/XMP) and upload files to stock platforms via FTP — all in one tool.

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
- ExifTool / Pillow + piexif
- React + TypeScript

## Getting Started
```bash
git clone https://github.com/valuuusha/socks-on-stocks.git
cd socks-on-stocks

# backend
pip install -r requirements.txt
uvicorn backend.main:app --reload

# frontend
cd src
npm install
npm run dev
```

## Project Structure
```
socks-on-stocks/
├── src/           # React + TypeScript frontend
│   ├── components/
│   ├── store/
│   └── api/
├── backend/       # Python FastAPI backend
│   ├── api/
│   ├── services/
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   └── main.py
├── docs/          # project documentation
├── tests/         # tests
└── requirements.txt
```

## Team

| Role | Developer |
|------|-----------|
| Frontend Core | Veronika Zinchenko |
| Frontend UI/UX | Anastasia Kovtoniuk |
| Backend API |  Valentyna Dermenzhy |
| Backend Validator | Anna Romanchuk |
| Backend Media | Anton Pihuliak|
