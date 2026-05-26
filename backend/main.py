from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_db
from backend.api.files import router as files_router

app = FastAPI(
    title="Socks on Stocks API",
    description="Backend for the stock photo metadata & FTP upload tool.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files_router)


@app.on_event("startup")
def on_startup():
    """Create DB tables on first run."""
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}