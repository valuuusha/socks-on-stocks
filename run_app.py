from __future__ import annotations

import os
import socket
import sys
import threading
import time
import urllib.request
from pathlib import Path

import uvicorn
import webview
from fastapi.staticfiles import StaticFiles

APP_HOST = "127.0.0.1"
DEFAULT_PORT = 8000


def runtime_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def bundled_path(*parts: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", runtime_dir()))
    return base.joinpath(*parts)


os.chdir(runtime_dir())

from backend.main import app  # noqa: E402


frontend_dist = bundled_path("frontend", "dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


def get_preferred_port() -> int:
    try:
        return int(os.environ.get("SOCKS_ON_STOCKS_PORT", DEFAULT_PORT))
    except ValueError:
        return DEFAULT_PORT


def find_available_port(start_port: int) -> int:
    for port in range(start_port, min(start_port + 100, 65536)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((APP_HOST, port))
            except OSError:
                continue
            return port

    raise RuntimeError("No available local port found for Socks on Stocks.")


def app_url(port: int) -> str:
    return f"http://{APP_HOST}:{port}"


def run_server(port: int) -> None:
    uvicorn.run(app, host=APP_HOST, port=port, log_level="info")


def wait_for_server(url: str, timeout_seconds: float = 10.0) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=0.5):
                return
        except OSError:
            time.sleep(0.2)



if __name__ == "__main__":
    port = find_available_port(get_preferred_port())
    url = app_url(port)

    if os.environ.get("SOCKS_ON_STOCKS_SERVER_ONLY") == "1":
        run_server(port)
    else:
        threading.Thread(target=run_server, args=(port,), daemon=True).start()
        wait_for_server(url)
        webview.create_window("Socks on Stocks", url, width=1280, height=800)
        webview.start()
