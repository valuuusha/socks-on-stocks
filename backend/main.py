from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_db
from backend.api.files import router as files_router
from backend.api.metadata import router as metadata_router
from backend.api.ftp import router as ftp_router

app = FastAPI(
    title="Socks on Stocks API",
    description="Backend for the stock photo metadata & FTP upload tool.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    # The packaged Electron renderer is loaded from file:// instead of Vite.
    # The API only listens on 127.0.0.1, so this does not expose it to a network.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", include_in_schema=False)
def health_check():
    """Small readiness endpoint used by the desktop shell."""
    return {"status": "ok"}

app.include_router(files_router)
app.include_router(metadata_router)
app.include_router(ftp_router)

@app.on_event("startup")
def on_startup():
    """Create DB tables on first run."""
    init_db()
