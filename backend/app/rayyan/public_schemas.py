"""Contracts for the Fale7 API (external apps) and its one-time QR links."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.rayyan.schemas import ValidationReportOut

ApiKeyStatus = Literal["active", "revoked"]


def _utc(value: datetime) -> datetime:
    """SQLite drops tzinfo; every stored timestamp is UTC."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class ApiKeyState(BaseModel):
    exists: bool
    status: ApiKeyStatus | None = None
    # Present exactly once: in the response that issues or re-issues the key.
    key: str | None = None
    key_prefix: str | None = None
    created_at: datetime | None = None
    revoked_at: datetime | None = None
    last_used_at: datetime | None = None
    request_count: int = 0
    requests_this_hour: int = 0
    rate_limit_per_hour: int = 0
    window_resets_at: datetime | None = None
    last_status: str | None = None
    last_error_code: str | None = None
    scopes: list[str] = Field(default_factory=list)

    @field_validator("created_at", "revoked_at", "last_used_at", "window_resets_at")
    @classmethod
    def _utc_times(cls, value: datetime | None) -> datetime | None:
        return _utc(value) if value else None


class AccessLinkOut(BaseModel):
    """Short-lived, single-use token; the browser builds the QR URL from it."""

    token: str
    expires_at: datetime

    @field_validator("expires_at")
    @classmethod
    def _utc_expiry(cls, value: datetime) -> datetime:
        return _utc(value)


class ApiAccessOut(BaseModel):
    """What the QR page shows once: the key plus its non-secret metadata."""

    key: str
    key_prefix: str
    status: ApiKeyStatus
    created_at: datetime
    scopes: list[str] = Field(default_factory=list)
    rate_limit_per_hour: int
    request_count: int
    requests_this_hour: int

    @field_validator("created_at")
    @classmethod
    def _utc_created(cls, value: datetime) -> datetime:
        return _utc(value)


class PublicAskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    field_id: int | None = Field(default=None, gt=0)
    crop: str | None = Field(default=None, max_length=40)
    language: Literal["en", "ar"] = "en"
    conversation_id: str | None = Field(default=None, max_length=64)

    @field_validator("question", "crop")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        cleaned = value.strip() if value else ""
        return cleaned or None


class RecommendationOut(BaseModel):
    """Deterministic values only; nothing here is generated text."""

    irrigation_demand: str | None
    irrigation_label: str | None
    demand_reasons: list[str] = Field(default_factory=list)
    crop_health_status: str | None
    crop_health_reason: str | None


class ConfidenceOut(BaseModel):
    level: str | None
    reasons: list[str] = Field(default_factory=list)


class ApiUsageOut(BaseModel):
    total_requests: int
    requests_this_hour: int
    rate_limit_per_hour: int
    window_resets_at: datetime | None

    @field_validator("window_resets_at")
    @classmethod
    def _utc_reset(cls, value: datetime | None) -> datetime | None:
        return _utc(value) if value else None


class PublicAskResponse(BaseModel):
    answer: str
    recommendation: RecommendationOut
    environmental_data: dict[str, Any]
    data_sources: list[dict[str, Any]]
    warnings: list[str]
    limitations: list[str]
    confidence: ConfidenceOut
    provider: Literal["gemini", "deterministic_fallback"]
    model: str | None
    data_mode: Literal["live", "demo"]
    validation: ValidationReportOut
    conversation_id: str
    usage: ApiUsageOut
