# Socks on Stocks

**Socks on Stocks** is a local workspace for stock-photo contributors. It helps authors import JPEG files, edit photo metadata, keep a reusable local catalog, export selected work, and upload files to stock platforms over FTP.

The project has two ways to use it:

- **Web development version** - React UI and FastAPI API run locally on the same computer.
- **Desktop version** - a self-contained Windows executable or macOS application distributed through [GitHub Releases](https://github.com/valuuusha/socks-on-stocks/releases).

## Features

- Import JPEG files by selecting files or uploading them in the browser
- Browse a thumbnail gallery and manage a local workspace
- Read and edit title, description, and keyword metadata
- Save metadata to the local catalog and write it to JPEG files through ExifTool
- Export selected images as a ZIP archive
- Create, edit, test, and use FTP profiles for stock-platform uploads
- Store workspace data in a local SQLite database; no cloud database is required

## Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Zustand, Lucide React |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic |
| Data | SQLite, SQLAlchemy |
| Media and metadata | Pillow, ExifTool |
| Desktop packaging | PyWebView + PyInstaller (Windows), Electron + electron-builder (macOS) |
| Network | FTP/FTPS via Python services |

## Architecture

The application follows a local client-server architecture. The React frontend calls the FastAPI backend over HTTP. The backend owns all business operations: file import, thumbnail generation, metadata read/write, archive export, FTP upload, and persistence.

```text
React + TypeScript UI
        |
        | HTTP / JSON
        v
FastAPI routers
        |
        +-- File and thumbnail services ------> local file system
        +-- Metadata service -----------------> ExifTool -> JPEG metadata
        +-- FTP service ----------------------> stock-platform FTP servers
        +-- SQLAlchemy ORM -------------------> local SQLite database
```

The detailed component and data-model diagrams are available in [docs/architecture](docs/architecture).

## Repository Layout

```text
socks-on-stocks/
|-- backend/                 FastAPI application, API routers, services, and models
|-- frontend/                React + TypeScript client
|-- docs/                    requirements, NFR evidence, and architecture diagrams
|-- requirements.txt         Python dependencies for the API
|-- README.md                project, launch, and release documentation
`-- .gitignore               local data, dependencies, IDE files, and build artifacts
```

`main` is the stable source branch for the web application. Desktop packaging code is maintained separately while platform-specific work is being finalized:

| Platform | Branch | Packaging approach |
| --- | --- | --- |
| Windows | `nannoue.exe` | PyWebView + PyInstaller |
| macOS | `nannoue.app` | Electron + electron-builder |

End users should normally download a ready-to-run application from [Releases](https://github.com/valuuusha/socks-on-stocks/releases), rather than build it from source.

## Run the Web Version Locally

### Prerequisites

Install these tools before cloning the repository:

- [Python 3.11 or newer](https://www.python.org/downloads/)
- [Node.js 20 or newer](https://nodejs.org/)
- Git

No external database, API key, or `.env` file is required for the default local setup. On its first start, the backend automatically creates `socks_on_stocks.db` in the project root. The database, uploaded files, preview cache, and virtual environments are ignored by Git.

### 1. Clone the repository

```bash
git clone https://github.com/valuuusha/socks-on-stocks.git
cd socks-on-stocks
```

### 2. Create a Python environment and install backend dependencies

**Windows PowerShell**

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

**macOS / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 3. Start the API

Keep this terminal open.

**Windows PowerShell**

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

**macOS / Linux**

```bash
.venv/bin/python -m uvicorn backend.main:app --reload
```

The API is available at <http://127.0.0.1:8000>. Interactive API documentation is at <http://127.0.0.1:8000/docs>.

### 4. Install frontend dependencies and start the UI

Open a **second terminal** in the repository root.

**Windows PowerShell**

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Use `npm.cmd` in PowerShell when the system blocks `npm.ps1` because of its execution policy.

**macOS / Linux**

```bash
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173> in a browser. Stop both development servers with `Ctrl+C`.

### Optional frontend environment variable

The UI calls `http://localhost:8000` by default, so no configuration is needed for the local setup. To point the UI to another API address, create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Restart Vite after changing this file. Do not commit `.env.local` if it contains environment-specific values.

### Verify a production frontend build

From `frontend/`:

```bash
npm run build
```

Vite writes the static frontend to `frontend/dist/`. The web API must still be running separately for the built frontend to perform file, metadata, and FTP operations.

## Use a Ready Desktop Application

Download the newest asset from the repository's [GitHub Releases page](https://github.com/valuuusha/socks-on-stocks/releases). A desktop build starts its local backend automatically and creates its local data on first run.

### Windows

1. Download `Socks-on-Stocks-Windows-x64.exe` from the chosen release.
2. Open the downloaded `.exe` file.
3. If Windows SmartScreen appears, confirm that the file was downloaded from this repository's official release and choose **More info** -> **Run anyway**. The project is not code-signed, so Windows may show a reputation warning.
4. The application opens in its own window. The local database is created automatically; no Python, Node.js, or database setup is needed.

### macOS

1. Download `Socks-on-Stocks-macOS.zip` (or the macOS `.dmg`, if published) from the chosen release.
2. For a ZIP asset, unzip it and move `Socks on Stocks.app` to `Applications` or another folder you own. For a DMG, open it and drag the app to `Applications`.
3. Because the build is not notarized, remove the download quarantine attribute once in Terminal:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Socks on Stocks.app"
   ```

   Adjust the quoted path if the app is stored elsewhere.
4. Open **Socks on Stocks** from Finder. The app starts its local API automatically; no separate backend setup is required.

## Build Desktop Applications from Source

Build each platform **on that platform**. The platform-specific packaging code is currently kept in dedicated branches.

### Windows executable

```powershell
git clone --branch nannoue.exe https://github.com/valuuusha/socks-on-stocks.git
cd socks-on-stocks

py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pyinstaller

cd frontend
npm.cmd ci
npm.cmd run build
cd ..
```

Before packaging, make sure the Windows branch contains the ExifTool distribution expected by the command:

```text
backend/exiftool.exe
backend/exiftool_files/
```

Then run this command from the repository root:

```powershell
.\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --name "Socks on Stocks" --windowed --onefile --icon="frontend\src\assets\logo.ico" --add-data "frontend\dist;frontend\dist" --add-data "backend\exiftool.exe;backend" --add-data "backend\exiftool_files;backend\exiftool_files" run_app.py
```

The result is `dist\Socks on Stocks.exe`. Test that file on a Windows computer before publishing it. Because `--onefile` is used, this executable can be uploaded directly to a GitHub Release.

### macOS application

```bash
git clone --branch nannoue.app https://github.com/valuuusha/socks-on-stocks.git
cd socks-on-stocks

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller

cd frontend
npm ci
npm run desktop:package
```

`electron-builder` creates the distributable macOS artifact in `frontend/dist/`. Test it on a Mac, then publish the generated `.dmg` or a ZIP archive containing `Socks on Stocks.app`.

## Quality Checks Before Submission

- `git status` reports no unexpected files.
- `npm run build` passes in `frontend/`.
- A new clone can start the API and frontend using the steps above.
- The Windows `.exe` and macOS app launch from their GitHub Release assets.
- The repository and Releases pages are public.
- The final Google Doc contains the repository link and, when published, the GitHub Release link.

## Team

| Role | Developer |
| --- | --- |
| Frontend Core | [Veronika Zinchenko](https://github.com/heloveroo) |
| Frontend UI/UX | [Anastasia Kovtoniuk](https://github.com/anastasiakovtoniuk) |
| Backend API | [Valentyna Dermenzhy](https://github.com/valuuusha) |
| Backend Validation | [Anna Romanchuk](https://github.com/AnnaRomanchuk) |
| Backend Media | [Anton Pihuliak](https://github.com/MaFiN1337) |
