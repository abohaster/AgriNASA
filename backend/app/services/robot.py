"""
Field-robot observations packaged for the dashboard, the water decision and AI.

PRINCIPLE
---------
A robot reading is a real measurement at one point in one field. It is never
extrapolated into a field average silently: this module reports how many
readings and which sensors contributed, and marks data as stale or unavailable
instead of carrying an old number forward.

STORAGE
-------
Readings live in `sensor_readings` exactly as uploaded. Nothing here writes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import RobotDevice, SensorReading

# A probe that has not reported within this window is treated as offline for
# any decision that calls itself current.
FRESH_WINDOW = timedelta(hours=6)
HISTORY_WINDOW = timedelta(hours=24)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _naive_utc(value: datetime) -> datetime:
    """SQLite stores naive UTC; convert an aware boundary before comparing."""
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


@dataclass
class SensorSnapshot:
    device_id: int
    device_label: str
    sensor_id: str | None
    soil_moisture_pct: float
    measured_at: str
    status: str
    latitude: float | None
    longitude: float | None


@dataclass
class RobotMoisture:
    status: str  # fresh | stale | unavailable
    latest_pct: float | None = None
    latest_measured_at: str | None = None
    latest_sensor_id: str | None = None
    latest_device_label: str | None = None
    latest_latitude: float | None = None
    latest_longitude: float | None = None
    measurement_status: str | None = None
    reading_count_24h: int = 0
    sensor_count: int = 0
    mean_pct_24h: float | None = None
    min_pct_24h: float | None = None
    max_pct_24h: float | None = None
    sensors: list[SensorSnapshot] = field(default_factory=list)
    reason: str | None = None

    @property
    def available_for_decision(self) -> bool:
        return self.status == "fresh" and self.latest_pct is not None


def _iso(value: datetime | None) -> str | None:
    resolved = _as_utc(value)
    return resolved.isoformat(timespec="seconds") if resolved else None


def field_moisture(session: Session, field_id: int, *, now: datetime | None = None) -> RobotMoisture:
    """Latest probe reading plus a 24-hour point summary for one field."""
    moment = now or datetime.now(timezone.utc)
    readings = list(
        session.scalars(
            select(SensorReading)
            .where(
                SensorReading.field_id == field_id,
                SensorReading.soil_moisture_pct.is_not(None),
                SensorReading.status != "error",
            )
            .order_by(SensorReading.measured_at.desc(), SensorReading.id.desc())
            .limit(500)
        )
    )
    if not readings:
        return RobotMoisture(
            status="unavailable",
            reason=(
                "No soil-moisture measurement has been uploaded for this field. "
                "Pair a robot and let it post readings."
            ),
        )

    devices = {
        device.id: device
        for device in session.scalars(
            select(RobotDevice).where(RobotDevice.field_id == field_id)
        )
    }
    latest = readings[0]
    age = moment - (_as_utc(latest.measured_at) or moment)
    status = "fresh" if age <= FRESH_WINDOW else "stale"
    reason = None
    if status == "stale":
        reason = (
            "The robot has not reported soil moisture within the last "
            f"{int(FRESH_WINDOW.total_seconds() // 3600)} hours. "
            "Last reading shown; it is not used for a current irrigation decision."
        )

    window_start = moment - HISTORY_WINDOW
    recent = [
        reading
        for reading in readings
        if (_as_utc(reading.measured_at) or window_start) >= window_start
    ]
    values = [float(reading.soil_moisture_pct) for reading in recent if reading.soil_moisture_pct is not None]

    # One snapshot per physical sensor keeps a chatty node from dominating the
    # field picture; sensors without an id are labelled by device.
    snapshots: dict[str, SensorSnapshot] = {}
    for reading in readings:
        device = devices.get(reading.device_id)
        key = reading.sensor_id or f"device-{reading.device_id}"
        if key in snapshots:
            continue
        snapshots[key] = SensorSnapshot(
            device_id=reading.device_id,
            device_label=device.label if device else "Field robot",
            sensor_id=reading.sensor_id,
            soil_moisture_pct=float(reading.soil_moisture_pct or 0.0),
            measured_at=_iso(reading.measured_at) or "",
            status=reading.status,
            latitude=reading.latitude,
            longitude=reading.longitude,
        )

    return RobotMoisture(
        status=status,
        latest_pct=float(latest.soil_moisture_pct or 0.0),
        latest_measured_at=_iso(latest.measured_at),
        latest_sensor_id=latest.sensor_id,
        latest_device_label=devices[latest.device_id].label if latest.device_id in devices else None,
        latest_latitude=latest.latitude,
        latest_longitude=latest.longitude,
        measurement_status=latest.status,
        reading_count_24h=len(recent),
        sensor_count=len(snapshots),
        mean_pct_24h=round(sum(values) / len(values), 2) if values else None,
        min_pct_24h=round(min(values), 2) if values else None,
        max_pct_24h=round(max(values), 2) if values else None,
        sensors=list(snapshots.values()),
        reason=reason,
    )


def moisture_series(
    session: Session,
    field_id: int,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = 500,
) -> list[SensorReading]:
    """Stored soil-moisture readings for the historical chart (newest last)."""
    query = select(SensorReading).where(
        SensorReading.field_id == field_id,
        SensorReading.soil_moisture_pct.is_not(None),
        SensorReading.status != "error",
    )
    if start is not None:
        query = query.where(SensorReading.measured_at >= _naive_utc(start))
    if end is not None:
        query = query.where(SensorReading.measured_at <= _naive_utc(end))
    rows = list(
        session.scalars(
            query.order_by(SensorReading.measured_at.desc(), SensorReading.id.desc()).limit(limit)
        )
    )
    return list(reversed(rows))


def context_block(moisture: RobotMoisture) -> dict[str, Any]:
    """Compact, self-describing block for the AI context and API responses."""
    return {
        "status": moisture.status,
        "source": "field robot soil-moisture probe (measured at one point)",
        "latest_pct": moisture.latest_pct,
        "latest_measured_at": moisture.latest_measured_at,
        "sensor_id": moisture.latest_sensor_id,
        "device_label": moisture.latest_device_label,
        "location": (
            {"latitude": moisture.latest_latitude, "longitude": moisture.latest_longitude}
            if moisture.latest_latitude is not None and moisture.latest_longitude is not None
            else None
        ),
        "measurement_status": moisture.measurement_status,
        "reading_count_24h": moisture.reading_count_24h,
        "sensor_count": moisture.sensor_count,
        "mean_pct_24h": moisture.mean_pct_24h,
        "min_pct_24h": moisture.min_pct_24h,
        "max_pct_24h": moisture.max_pct_24h,
        "sensors": [
            {
                "device_label": snapshot.device_label,
                "sensor_id": snapshot.sensor_id,
                "soil_moisture_pct": snapshot.soil_moisture_pct,
                "measured_at": snapshot.measured_at,
                "status": snapshot.status,
                "location": (
                    {"latitude": snapshot.latitude, "longitude": snapshot.longitude}
                    if snapshot.latitude is not None and snapshot.longitude is not None
                    else None
                ),
            }
            for snapshot in moisture.sensors
        ],
        "reason": moisture.reason,
        "note": (
            "A probe measures at one point and one depth. It does not represent "
            "the whole field; several readings are summarised only when they exist."
        ),
    }
