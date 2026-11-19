"""Request/response contracts for field robots and their sensor readings."""

from __future__ import annotations

import math
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _utc(value: datetime) -> datetime:
    """SQLite drops tzinfo; every stored timestamp is UTC, so say so on output."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class PairingCodeCreate(BaseModel):
    field_id: int = Field(gt=0)


class PairingCodeOut(BaseModel):
    code: str
    field_id: int
    field_name: str
    expires_at: datetime

    @field_validator("expires_at")
    @classmethod
    def _utc_expiry(cls, value: datetime) -> datetime:
        return _utc(value)


class PairingCodeInfo(BaseModel):
    valid: bool
    field_id: int
    field_name: str
    expires_at: datetime

    @field_validator("expires_at")
    @classmethod
    def _utc_expiry(cls, value: datetime) -> datetime:
        return _utc(value)


class DeviceCreate(BaseModel):
    field_id: int = Field(gt=0)
    label: str | None = Field(default=None, max_length=60)

    @field_validator("label")
    @classmethod
    def _clean_label(cls, value: str | None) -> str | None:
        cleaned = value.strip() if value else ""
        return cleaned[:60] or None


class DeviceClaim(BaseModel):
    code: str = Field(min_length=4, max_length=32)
    label: str | None = Field(default=None, max_length=60)

    @field_validator("code")
    @classmethod
    def _clean_code(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("label")
    @classmethod
    def _clean_label(cls, value: str | None) -> str | None:
        cleaned = value.strip() if value else ""
        return cleaned[:60] or None


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    field_id: int
    label: str
    token_prefix: str
    active: bool
    created_at: datetime
    last_seen_at: datetime | None

    @field_validator("created_at", "last_seen_at")
    @classmethod
    def _utc_times(cls, value: datetime | None) -> datetime | None:
        return _utc(value) if value else None


class DeviceTokenOut(BaseModel):
    """Returned once, at creation; the plaintext token is never stored or re-shown."""

    token: str
    device: DeviceOut
    field_name: str


MEASUREMENT_STATUSES = ("ok", "degraded", "error")


class SensorReadingIn(BaseModel):
    soil_moisture_pct: float | None = Field(default=None, ge=0, le=100)
    air_temp_c: float | None = Field(default=None, ge=-40, le=60)
    humidity_pct: float | None = Field(default=None, ge=0, le=100)
    distance_cm: float | None = Field(default=None, ge=2, le=500)
    sensor_id: str | None = Field(default=None, max_length=64)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    status: str = Field(default="ok", max_length=24)
    measured_at: datetime | None = None

    @field_validator("sensor_id")
    @classmethod
    def _clean_sensor_id(cls, value: str | None) -> str | None:
        cleaned = value.strip() if value else ""
        return cleaned[:64] or None

    @field_validator("status")
    @classmethod
    def _known_status(cls, value: str) -> str:
        normalised = value.strip().lower()
        if normalised not in MEASUREMENT_STATUSES:
            raise ValueError(f"status must be one of {', '.join(MEASUREMENT_STATUSES)}")
        return normalised

    @model_validator(mode="after")
    def _coordinates_pair(self) -> "SensorReadingIn":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Send both latitude and longitude, or neither.")
        return self

    @model_validator(mode="after")
    def _at_least_one_value(self) -> "SensorReadingIn":
        values = (self.soil_moisture_pct, self.air_temp_c, self.humidity_pct, self.distance_cm)
        if all(value is None for value in values):
            raise ValueError("Send at least one sensor value.")
        for value in values:
            if value is not None and not math.isfinite(value):
                raise ValueError("Sensor values must be finite numbers.")
        return self


class SensorReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int
    field_id: int
    soil_moisture_pct: float | None
    air_temp_c: float | None
    humidity_pct: float | None
    distance_cm: float | None
    sensor_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str = "ok"
    measured_at: datetime
    received_at: datetime

    @field_validator("measured_at", "received_at")
    @classmethod
    def _utc_times(cls, value: datetime) -> datetime:
        return _utc(value)


class FieldSensorsOut(BaseModel):
    field_id: int
    devices: list[DeviceOut]
    latest: SensorReadingOut | None
    readings: list[SensorReadingOut]