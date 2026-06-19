import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

def _database_url() -> str:
    """Keep desktop data outside the read-only application bundle."""
    data_dir = os.getenv("SOCKS_ON_STOCKS_DATA_DIR")
    if data_dir:
        root = Path(data_dir).expanduser().resolve()
        root.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{root / 'socks_on_stocks.db'}"

    # Retains the existing behaviour when the API is started directly.
    return "sqlite:///./socks_on_stocks.db"


DATABASE_URL = _database_url()

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False},)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
