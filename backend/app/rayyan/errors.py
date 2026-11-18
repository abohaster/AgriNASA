"""
RAYAN errors.

They subclass the project's `AppError` so the existing uniform error envelope
in `app/main.py` renders them correctly once the router is included. The
isolated app registers the same envelope.

Rules:
* Messages are safe to show to the user and the browser.
* No provider response header, API key or ciphertext is ever included.
"""

from __future__ import annotations

from app.exceptions import AppError


class RayyanError(AppError):
    code = "RAYAN_ERROR"
    status_code = 500


class SettingsAuthError(RayyanError):
    code = "SETTINGS_UNAUTHORIZED"

    def __init__(self, message: str, details: str | None = None, status_code: int = 401):
        super().__init__(message, details)
        self.status_code = status_code


class NoActiveKeyError(RayyanError):
    code = "RAYAN_NO_ACTIVE_KEY"
    status_code = 409


class KeyInvalidError(RayyanError):
    code = "GEMINI_KEY_INVALID"
    status_code = 409


class KeyRejectedError(RayyanError):
    """A key failed live validation and was therefore not saved."""

    code = "GEMINI_KEY_REJECTED"
    status_code = 422


class QuotaExceededError(RayyanError):
    code = "GEMINI_QUOTA_EXCEEDED"
    status_code = 429


class ModelNotFoundError(RayyanError):
    code = "GEMINI_MODEL_NOT_FOUND"
    status_code = 409


class UnsupportedModelError(RayyanError):
    code = "GEMINI_MODEL_UNSUPPORTED"
    status_code = 422


class ProviderUnavailableError(RayyanError):
    code = "GEMINI_UNAVAILABLE"
    status_code = 502


class ProviderTimeoutError(RayyanError):
    code = "GEMINI_TIMEOUT"
    status_code = 504


class ProviderBlockedError(RayyanError):
    code = "GEMINI_RESPONSE_BLOCKED"
    status_code = 502


class KeyLimitError(RayyanError):
    code = "RAYAN_KEY_LIMIT"
    status_code = 409


class KeyNotActivatableError(RayyanError):
    code = "RAYAN_KEY_NOT_ACTIVATABLE"
    status_code = 409


class KeyStoreError(RayyanError):
    code = "RAYAN_KEY_STORE_ERROR"
    status_code = 500


class RateLimitedError(RayyanError):
    code = "RAYAN_RATE_LIMITED"
    status_code = 429
