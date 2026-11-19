"""
Field-robot pairing, device keys and sensor ingestion.

FLOW
----
1. `POST /devices/pairing-codes` issues a short-lived one-time code for a field.
   The Fale7 page renders it as a QR code.
2. Scanning the QR opens `/robot/pair/<code>`; claiming it mints a bearer token
   for the physical node. Only the SHA-256 hash is stored.
3. The node posts readings to `/ingest/readings` with that token.
4. `/fields/{id}/sensors` returns the latest reading plus a short series.

The plaintext device token is returned exactly once, at creation.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.database import get_session
from app.db.models import Field, PairingCode, RobotDevice, SensorReading, utcnow
from app.exceptions import DeviceUnauthorized, NotFoundError, PairingCodeGone, ValidationFailure
from app.schemas.devices import (
    DeviceClaim,
    DeviceCreate,
    DeviceOut,
    DeviceTokenOut,
    FieldSensorsOut,
    PairingCodeCreate,
    PairingCodeInfo,
    PairingCodeOut,
    SensorReadingIn,
    SensorReadingOut,
)

router = APIRouter(prefix="/devices", tags=["devices"])
readings_router = APIRouter(prefix="/ingest", tags=["devices"])
field_router = APIRouter(prefix="/fields", tags=["devices"])

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_TTL = timedelta(minutes=15)
SERIES_LIMIT = 60
MAX_ACTIVE_DEVICES = 10


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    """SQLite returns naive datetimes; treat stored values as UTC."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _field_or_404(session: Session, field_id: int) -> Field:
    field = session.get(Field, field_id)
    if field is None:
        raise NotFoundError(
            "Field not found.",
            details="The field may have been deleted. Create a field before pairing a robot.",
        )
    return field


def _new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))


def _issue_device(session: Session, field: Field, label: str | None) -> DeviceTokenOut:
    active_count = len(
        session.scalars(
            select(RobotDevice.id).where(
                RobotDevice.field_id == field.id, RobotDevice.active.is_(True)
            )
        ).all()
    )
    if active_count >= MAX_ACTIVE_DEVICES:
        raise ValidationFailure(
            "This field already has the maximum number of active robots.",
            details=f"Revoke an unused robot first (limit {MAX_ACTIVE_DEVICES}).",
        )

    token = "ags_" + secrets.token_urlsafe(32)
    device = RobotDevice(
        field_id=field.id,
        label=(label or "Field robot")[:60],
        token_prefix=token[:12],
        token_hash=_sha256(token),
        active=True,
    )
    session.add(device)
    session.flush()
    return DeviceTokenOut(
        token=token,
        device=DeviceOut.model_validate(device),
        field_name=field.name,
    )


@router.post(
    "/pairing-codes",
    response_model=PairingCodeOut,
    status_code=status.HTTP_201_CREATED,
)
def create_pairing_code(
    payload: PairingCodeCreate, session: Session = Depends(get_session)
) -> PairingCodeOut:
    field = _field_or_404(session, payload.field_id)
    now = utcnow()
    expires = now + CODE_TTL

    code = _new_code()
    for _ in range(5):
        exists = session.scalar(
            select(PairingCode.id).where(PairingCode.code_hash == _sha256(code))
        )
        if exists is None:
            break
        code = _new_code()

    session.add(PairingCode(field_id=field.id, code_hash=_sha256(code), expires_at=expires))
    session.commit()
    return PairingCodeOut(
        code=code, field_id=field.id, field_name=field.name, expires_at=expires
    )


@router.get("/pairing-codes/{code}", response_model=PairingCodeInfo)
def get_pairing_code(code: str, session: Session = Depends(get_session)) -> PairingCodeInfo:
    row = session.scalar(
        select(PairingCode).where(PairingCode.code_hash == _sha256(code.strip().upper()))
    )
    if row is None:
        raise NotFoundError(
            "This pairing code is not recognised.",
            details="Create a new QR code from the Fale7 page.",
        )
    field = session.get(Field, row.field_id)
    if field is None:
        raise NotFoundError("The field for this pairing code no longer exists.")
    if row.used_at is not None:
        raise PairingCodeGone(
            "This pairing code has already been used.",
            details="Generate a new QR code for each robot.",
        )
    if _as_utc(row.expires_at) <= utcnow():
        raise PairingCodeGone(
            "This pairing code has expired.",
            details="Pairing codes are valid for 15 minutes. Generate a new one.",
        )
    return PairingCodeInfo(
        valid=True, field_id=field.id, field_name=field.name, expires_at=row.expires_at
    )


@router.post("/claim", response_model=DeviceTokenOut, status_code=status.HTTP_201_CREATED)
def claim_pairing_code(
    payload: DeviceClaim, session: Session = Depends(get_session)
) -> DeviceTokenOut:
    now = utcnow()
    code_hash = _sha256(payload.code)

    # Mark used first: the conditional UPDATE makes the code single-use even if
    # two claims arrive at the same time.
    claimed = session.execute(
        update(PairingCode)
        .where(PairingCode.code_hash == code_hash, PairingCode.used_at.is_(None))
        .values(used_at=now)
    )
    if claimed.rowcount != 1:
        session.rollback()
        raise PairingCodeGone(
            "This pairing code has already been used or has expired.",
            details="Generate a new QR code on the Fale7 page.",
        )

    row = session.scalar(select(PairingCode).where(PairingCode.code_hash == code_hash))
    assert row is not None  # guaranteed by the UPDATE above
    if _as_utc(row.expires_at) <= now:
        session.rollback()
        raise PairingCodeGone(
            "This pairing code has expired.",
            details="Pairing codes are valid for 15 minutes. Generate a new one.",
        )

    field = _field_or_404(session, row.field_id)
    result = _issue_device(session, field, payload.label)
    session.commit()
    return result


@router.post("", response_model=DeviceTokenOut, status_code=status.HTTP_201_CREATED)
def create_device(payload: DeviceCreate, session: Session = Depends(get_session)) -> DeviceTokenOut:
    field = _field_or_404(session, payload.field_id)
    result = _issue_device(session, field, payload.label)
    session.commit()
    return result


@router.get("", response_model=list[DeviceOut])
def list_devices(
    field_id: int | None = None, session: Session = Depends(get_session)
) -> list[RobotDevice]:
    query = select(RobotDevice).order_by(RobotDevice.created_at.desc())
    if field_id is not None:
        query = query.where(RobotDevice.field_id == field_id)
    return list(session.scalars(query))


@router.delete(
    "/{device_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response
)
def revoke_device(device_id: int, session: Session = Depends(get_session)):
    device = session.get(RobotDevice, device_id)
    if device is None:
        raise NotFoundError("Robot not found.")
    device.active = False
    session.commit()


def _device_from_header(
    session: Session, authorization: str | None
) -> RobotDevice:
    if not authorization:
        raise DeviceUnauthorized(
            "A device key is required.",
            details="Send 'Authorization: Bearer <device key>' from the robot.",
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise DeviceUnauthorized(
            "The device key header is malformed.",
            details="Expected 'Authorization: Bearer <device key>'.",
        )
    device = session.scalar(
        select(RobotDevice).where(
            RobotDevice.token_hash == _sha256(token.strip()),
            RobotDevice.active.is_(True),
        )
    )
    if device is None:
        raise DeviceUnauthorized(
            "This device key is not valid or has been revoked.",
            details="Pair the robot again to receive a new key.",
        )
    return device


@readings_router.post(
    "/readings", response_model=SensorReadingOut, status_code=status.HTTP_201_CREATED
)
def ingest_reading(
    payload: SensorReadingIn,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> SensorReading:
    device = _device_from_header(session, authorization)
    now = utcnow()
    measured = _as_utc(payload.measured_at) if payload.measured_at else now
    if measured > now + timedelta(minutes=10):
        raise ValidationFailure(
            "The reading timestamp is in the future.",
            details="Check the robot's clock or omit measured_at to use server time.",
        )
    if measured < now - timedelta(days=30):
        raise ValidationFailure(
            "The reading is older than 30 days.",
            details="Only recent readings are accepted.",
        )

    reading = SensorReading(
        device_id=device.id,
        field_id=device.field_id,
        soil_moisture_pct=payload.soil_moisture_pct,
        air_temp_c=payload.air_temp_c,
        humidity_pct=payload.humidity_pct,
        distance_cm=payload.distance_cm,
        sensor_id=payload.sensor_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status=payload.status,
        measured_at=measured,
        received_at=now,
    )
    device.last_seen_at = now
    session.add(reading)
    session.commit()
    session.refresh(reading)
    return reading


@field_router.get("/{field_id}/sensors", response_model=FieldSensorsOut)
def field_sensors(field_id: int, session: Session = Depends(get_session)) -> FieldSensorsOut:
    _field_or_404(session, field_id)
    devices = list(
        session.scalars(
            select(RobotDevice)
            .where(RobotDevice.field_id == field_id)
            .order_by(RobotDevice.created_at.desc())
        )
    )
    readings = list(
        session.scalars(
            select(SensorReading)
            .where(SensorReading.field_id == field_id)
            .order_by(SensorReading.measured_at.desc(), SensorReading.id.desc())
            .limit(SERIES_LIMIT)
        )
    )
    latest = SensorReadingOut.model_validate(readings[0]) if readings else None
    return FieldSensorsOut(
        field_id=field_id,
        devices=[DeviceOut.model_validate(device) for device in devices],
        latest=latest,
        readings=[SensorReadingOut.model_validate(reading) for reading in readings],
    )