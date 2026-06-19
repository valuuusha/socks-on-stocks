"""Entry point frozen into the macOS application's local API executable."""

import os

import uvicorn
from backend.main import app


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.getenv("SOCKS_ON_STOCKS_PORT", "8000")),
        log_level="warning",
    )
