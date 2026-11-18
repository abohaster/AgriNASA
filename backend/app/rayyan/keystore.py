"""
Encrypted Gemini key store.

A dedicated SQLAlchemy Core table keeps RAYAN independent of the existing ORM
models: `app/db/models.py` and `app/db/database.py` do not need to change. The
table is created on RAYAN startup with its own MetaData.

Only ciphertext and a pre-computed masked hint are stored. The plaintext key
enters this module once (to be encrypted) and leaves it only when the backend
needs to call Gemini.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Engine, MetaData, String, Table, Text
from sqlalchemy import delete as sa_delete
from sqlalchemy import select, update
from sqlalchemy.engine import RowMapping
from sqlalchemy.orm import Session

metadata = MetaData()

rayyan_api_keys = Table(
    "rayyan_api_keys",
    metadata,
    Column("id", String(32), primary_key=True),
    Column("label", String(120), nullable=False),
    Column("ciphertext", Text, nullable=False),
    Column("masked_hint", String(64), nullable=False),
    Column("status", String(20), nullable=False, default="valid"),
    Column("active", Boolean, nullable=False, default=False),
    Column("model", String(120), nullable=True),
    Column("created_at", DateTime, nullable=False),
    Column("last_validated_at", DateTime, nullable=True),
    Column("last_error_code", String(60), nullable=True),
    Column("last_error_message", String(300), nullable=True),
)


def ensure_schema(engine: Engine) -> None:
    """Create the RAYAN table without touching any existing table."""
    metadata.create_all(bind=engine, tables=[rayyan_api_keys])


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_key_id() -> str:
    return uuid.uuid4().hex


def list_keys(session: Session) -> list[RowMapping]:
    query = select(rayyan_api_keys).order_by(
        rayyan_api_keys.c.created_at.desc(), rayyan_api_keys.c.id
    )
    return list(session.execute(query).mappings())


def get_key(session: Session, key_id: str) -> RowMapping | None:
    query = select(rayyan_api_keys).where(rayyan_api_keys.c.id == key_id)
    return session.execute(query).mappings().first()


def active_key(session: Session) -> RowMapping | None:
    query = (
        select(rayyan_api_keys)
        .where(rayyan_api_keys.c.active.is_(True))
        .order_by(rayyan_api_keys.c.created_at.desc())
    )
    return session.execute(query).mappings().first()


def count_keys(session: Session) -> int:
    return len(list(session.execute(select(rayyan_api_keys.c.id))))


def create_key(
    session: Session,
    *,
    label: str,
    ciphertext: str,
    masked_hint: str,
    status: str,
    model: str | None,
    active: bool,
    last_validated_at: datetime | None,
) -> str:
    key_id = new_key_id()
    now = utcnow()
    if active:
        _deactivate_all(session)
    session.execute(
        rayyan_api_keys.insert().values(
            id=key_id,
            label=label,
            ciphertext=ciphertext,
            masked_hint=masked_hint,
            status=status,
            active=active,
            model=model,
            created_at=now,
            last_validated_at=last_validated_at,
            last_error_code=None,
            last_error_message=None,
        )
    )
    session.flush()
    return key_id


def record_validation(
    session: Session,
    key_id: str,
    *,
    status: str,
    model: str | None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    session.execute(
        update(rayyan_api_keys)
        .where(rayyan_api_keys.c.id == key_id)
        .values(
            status=status,
            model=model,
            last_validated_at=utcnow(),
            last_error_code=error_code,
            last_error_message=(error_message or "")[:300] or None,
        )
    )
    session.flush()


def record_use(
    session: Session,
    key_id: str,
    *,
    model: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    values: dict[str, object] = {
        "last_error_code": error_code,
        "last_error_message": (error_message or "")[:300] or None,
    }
    if model:
        values["model"] = model
    if error_code is None:
        values["last_validated_at"] = utcnow()
    session.execute(
        update(rayyan_api_keys).where(rayyan_api_keys.c.id == key_id).values(**values)
    )
    session.flush()


def activate_key(session: Session, key_id: str) -> bool:
    row = get_key(session, key_id)
    if row is None:
        return False
    _deactivate_all(session)
    session.execute(
        update(rayyan_api_keys).where(rayyan_api_keys.c.id == key_id).values(active=True)
    )
    session.flush()
    return True


def set_model(session: Session, key_id: str, model: str | None) -> bool:
    row = get_key(session, key_id)
    if row is None:
        return False
    session.execute(
        update(rayyan_api_keys).where(rayyan_api_keys.c.id == key_id).values(model=model)
    )
    session.flush()
    return True


def set_label(session: Session, key_id: str, label: str) -> bool:
    row = get_key(session, key_id)
    if row is None:
        return False
    session.execute(
        update(rayyan_api_keys).where(rayyan_api_keys.c.id == key_id).values(label=label)
    )
    session.flush()
    return True


def delete_key(session: Session, key_id: str) -> bool:
    row = get_key(session, key_id)
    if row is None:
        return False
    session.execute(sa_delete(rayyan_api_keys).where(rayyan_api_keys.c.id == key_id))
    session.flush()
    return True


def _deactivate_all(session: Session) -> None:
    session.execute(update(rayyan_api_keys).values(active=False))
    session.flush()
