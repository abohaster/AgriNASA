"""
Database engine and session management.

SQLite is the default so the project runs with zero infrastructure. Switching to
PostgreSQL only requires DATABASE_URL; the models use portable SQLAlchemy types.
"""

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()


def _prepare_sqlite_directory() -> None:
    path = settings.sqlite_path
    if path is not None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)


_prepare_sqlite_directory()

engine = create_engine(
    settings.database_url,
    # The dashboard requests environment, irrigation and health concurrently;
    # SQLite needs a wait window instead of failing immediately on a write lock.
    connect_args={"check_same_thread": False, "timeout": 30} if settings.is_sqlite else {},
    pool_pre_ping=True,
    future=True,
)


if settings.is_sqlite:

    @event.listens_for(engine, "connect")
    def _configure_sqlite(dbapi_connection, _connection_record) -> None:
        """WAL lets readers proceed while one request writes; busy_timeout serialises writers."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# Additive columns introduced after the first release. `create_all` never
# alters an existing table, so an existing deployment needs these ALTERs; every
# column is nullable (or has a default) so old rows remain valid.
_ADDITIVE_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "sensor_readings": [
        ("sensor_id", "VARCHAR(64)"),
        ("latitude", "FLOAT"),
        ("longitude", "FLOAT"),
        ("status", "VARCHAR(24) NOT NULL DEFAULT 'ok'"),
    ],
}


def _ensure_additive_columns() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table, columns in _ADDITIVE_COLUMNS.items():
            if table not in tables:
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, ddl in columns:
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def init_db() -> None:
    """Create tables, add late columns, and seed the catalogue / local user."""
    from app.db import models  # noqa: F401 — registers tables on Base.metadata
    from app.db.seed import seed_reference_data

    Base.metadata.create_all(bind=engine)
    _ensure_additive_columns()

    with SessionLocal() as session:
        seed_reference_data(session)
        session.commit()
