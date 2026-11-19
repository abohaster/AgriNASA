"""Contracts for robot plant photos, healthy references and AI image review."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator

# The only labels the review may return. Each one is deliberately cautious.
REVIEW_LABELS = {
    "healthy_appearance": "Healthy appearance",
    "possible_stress": "Possible stress",
    "possible_nutrient_issue": "Possible nutrient-related issue",
    "possible_disease_symptoms": "Possible disease symptoms",
    "possible_environmental_stress": "Possible environmental stress",
    "uncertain": "Uncertain — additional inspection recommended",
}

GROWTH_STAGES = (
    "germination",
    "seedling",
    "vegetative_growth",
    "flowering",
    "fruiting",
    "maturity",
    "harvest",
)


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class ImageUploadIn(BaseModel):
    # Base64-encoded bytes, no data: prefix. JSON keeps the upload free of extra
    # multipart dependencies and mirrors what a camera node can post directly.
    image_base64: str = Field(min_length=32, max_length=16_000_000)
    content_type: str = Field(default="image/jpeg", max_length=40)
    captured_at: datetime | None = None
    growth_stage: str | None = Field(default=None, max_length=40)
    camera_id: str | None = Field(default=None, max_length=64)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    note: str | None = Field(default=None, max_length=255)

    @field_validator("content_type")
    @classmethod
    def _image_type(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in {"image/jpeg", "image/png", "image/webp"}:
            raise ValueError("Only JPEG, PNG or WebP images are accepted.")
        return cleaned

    @field_validator("growth_stage")
    @classmethod
    def _stage(cls, value: str | None) -> str | None:
        cleaned = (value or "").strip().lower()
        if not cleaned:
            return None
        if cleaned not in GROWTH_STAGES:
            raise ValueError(f"growth_stage must be one of {', '.join(GROWTH_STAGES)}")
        return cleaned

    @field_validator("camera_id", "note")
    @classmethod
    def _clean_text(cls, value: str | None) -> str | None:
        cleaned = (value or "").strip()
        return cleaned[:255] or None


class ReferenceUploadIn(BaseModel):
    crop_id: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=120)
    image_base64: str = Field(min_length=32, max_length=16_000_000)
    content_type: str = Field(default="image/jpeg", max_length=40)
    source_note: str | None = Field(default=None, max_length=255)

    @field_validator("content_type")
    @classmethod
    def _image_type(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in {"image/jpeg", "image/png", "image/webp"}:
            raise ValueError("Only JPEG, PNG or WebP images are accepted.")
        return cleaned


class AnalysisOut(BaseModel):
    id: int
    status: str  # ok | unavailable
    label: str | None
    label_text: str | None
    confidence_pct: float | None
    summary: str | None
    observations: list[str]
    comparison: dict
    limitations: list[str]
    provider: str | None
    model: str | None
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def _utc_time(cls, value: datetime) -> datetime:
        return _utc(value)  # type: ignore[return-value]


class RobotImageOut(BaseModel):
    id: int
    field_id: int
    crop_id: str
    growth_stage: str | None
    captured_at: datetime
    received_at: datetime
    latitude: float | None
    longitude: float | None
    camera_id: str | None
    note: str | None
    content_type: str
    size_bytes: int
    file_url: str
    analysis: AnalysisOut | None = None

    @field_validator("captured_at", "received_at")
    @classmethod
    def _utc_times(cls, value: datetime) -> datetime:
        return _utc(value)  # type: ignore[return-value]


class ReferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crop_id: str
    label: str
    content_type: str
    size_bytes: int
    source_note: str | None
    created_at: datetime
    file_url: str

    @field_validator("created_at")
    @classmethod
    def _utc_time(cls, value: datetime) -> datetime:
        return _utc(value)  # type: ignore[return-value]


class FieldImagesOut(BaseModel):
    field_id: int
    crop_id: str
    images: list[RobotImageOut]
    references: list[ReferenceOut]
    healthy_reference_available: bool


class MoisturePointOut(BaseModel):
    id: int
    soil_moisture_pct: float
    measured_at: datetime
    sensor_id: str | None
    sensor_label: str
    status: str
    latitude: float | None
    longitude: float | None

    @field_validator("measured_at")
    @classmethod
    def _utc_time(cls, value: datetime) -> datetime:
        return _utc(value)  # type: ignore[return-value]


class FieldMoistureOut(BaseModel):
    field_id: int
    status: str
    latest_pct: float | None
    latest_measured_at: datetime | None
    latest_sensor_id: str | None
    measurement_status: str | None
    reading_count: int
    sensor_count: int
    mean_pct: float | None
    min_pct: float | None
    max_pct: float | None
    reason: str | None
    points: list[MoisturePointOut]

    @field_validator("latest_measured_at")
    @classmethod
    def _utc_time(cls, value: datetime | None) -> datetime | None:
        return _utc(value)
