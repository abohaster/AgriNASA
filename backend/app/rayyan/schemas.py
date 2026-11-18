"""Pydantic contracts for the RAYAN API (isolated from existing schemas)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.engine import RowMapping

KeyStatus = Literal["valid", "invalid", "quota_limited"]
ValidationStatus = Literal["valid", "invalid", "quota_limited", "error"]
KeySource = Literal["saved", "environment"]
AuthMode = Literal["token", "loopback"]


def key_status(row: RowMapping) -> KeyStatus:
    """Derive the displayed status without discarding quota information."""
    if row["status"] == "invalid":
        return "invalid"
    if row["last_error_code"] == "GEMINI_QUOTA_EXCEEDED":
        return "quota_limited"
    return "valid"


def key_out(row: RowMapping, *, source: KeySource = "saved") -> "KeyOut":
    return KeyOut(
        id=row["id"],
        label=row["label"],
        masked_key=row["masked_hint"],
        status=key_status(row),
        active=bool(row["active"]),
        model=row["model"],
        created_at=row["created_at"],
        last_validated_at=row["last_validated_at"],
        last_error_code=row["last_error_code"],
        last_error_message=row["last_error_message"],
        source=source,
    )


class KeyOut(BaseModel):
    id: str
    label: str
    masked_key: str
    status: KeyStatus
    active: bool
    model: str | None
    created_at: datetime
    last_validated_at: datetime | None
    last_error_code: str | None
    last_error_message: str | None
    source: KeySource = "saved"


class KeyCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    api_key: str = Field(min_length=20, max_length=200)
    model: str | None = Field(default=None, max_length=120)

    @field_validator("label", "api_key")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("model")
    @classmethod
    def _strip_model(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class KeyUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    model: str | None = Field(default=None, max_length=120)

    @field_validator("label", "model")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class ModelListResponse(BaseModel):
    key_id: str
    key_label: str
    source: KeySource
    models: list[str]
    default_model: str | None
    cached: bool
    models_source: Literal["live", "cached", "unavailable"]


class ValidateResponse(BaseModel):
    key_id: str
    valid: bool
    status: ValidationStatus
    code: str | None
    message: str
    models: list[str] = Field(default_factory=list)
    model: str | None
    checked_at: datetime


class SettingsStatus(BaseModel):
    configured: bool
    source: Literal["saved", "environment", "none"]
    active_key: KeyOut | None
    keys: list[KeyOut]
    models: list[str] = Field(default_factory=list)
    models_source: Literal["live", "cached", "unavailable"] = "unavailable"
    settings_token_required: bool
    auth_mode: AuthMode
    bootstrap_env_present: bool
    encryption: str = "Fernet (AES-128-CBC + HMAC-SHA256)"
    key_storage: str = "server-side encrypted table"


class AvailabilityResponse(BaseModel):
    """Non-secret summary used by the chat page to decide whether to enable input."""

    configured: bool
    source: Literal["saved", "environment", "none"]
    active_key_label: str | None
    active_key_status: KeyStatus | None
    model: str | None
    auth_mode: AuthMode
    data_mode: Literal["live", "demo"]
    max_requests_per_hour: int


class CapabilityOut(BaseModel):
    id: str
    label: str
    status: Literal[
        "AVAILABLE",
        "PARTIALLY_AVAILABLE",
        "CONFIGURATION_REQUIRED",
        "DATA_UNAVAILABLE",
        "DEMO_ONLY",
        "NOT_IMPLEMENTED",
    ]
    detail: str
    source_id: str | None = None


class CapabilitiesResponse(BaseModel):
    data_mode: Literal["live", "demo"]
    capabilities: list[CapabilityOut]
    unavailable_ids: list[str]


class AskRequest(BaseModel):
    field_id: int = Field(gt=0)
    message: str = Field(min_length=2, max_length=1000)
    lang: Literal["en", "ar"] = "en"
    conversation_id: str | None = Field(default=None, max_length=64)
    mode: Literal["live", "demo"] | None = None

    @field_validator("message")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Ask a slightly longer question.")
        return cleaned


class ValidationReportOut(BaseModel):
    status: Literal["passed", "rejected", "skipped"]
    checks: list[str] = Field(default_factory=list)
    rejected_numbers: list[str] = Field(default_factory=list)
    removed_urls: int = 0
    word_count: int = 0


class ProviderErrorOut(BaseModel):
    code: str
    message: str


class AskResponse(BaseModel):
    reply: str
    provider: Literal["gemini", "deterministic_fallback"]
    model: str | None
    key_id: str | None
    key_label: str | None
    conversation_id: str
    conversation_persisted: bool = False
    notice: str
    is_demo: bool
    context_used: dict[str, Any]
    capabilities: list[CapabilityOut]
    sources: list[dict[str, Any]]
    validation: ValidationReportOut
    provider_error: ProviderErrorOut | None = None
    usage: dict[str, Any] | None = None
