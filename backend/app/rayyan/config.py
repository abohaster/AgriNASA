"""
RAYAN configuration.

Every value is optional. A fresh installation works without touching `.env`:
keys are added in the RAYAN API Settings screen and stored encrypted.

Environment variables (all optional):
* RAYAN_GEMINI_API_KEY     bootstrap key when no saved key is active
* RAYAN_GEMINI_MODEL       default model, otherwise discovered from the API
* RAYAN_ENCRYPTION_KEY     Fernet key; when absent a keyfile is generated
* RAYAN_KEYFILE_PATH       override the generated keyfile location
* RAYAN_SETTINGS_TOKEN     protects the key-management endpoints in deployment
* RAYAN_MAX_REQUESTS_PER_HOUR
* RAYAN_GEMINI_TIMEOUT_SECONDS
* RAYAN_GEMINI_CONNECT_TIMEOUT_SECONDS
* RAYAN_GEMINI_PROBE_TIMEOUT_SECONDS
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# app/rayyan/config.py -> app -> backend
BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
SECRETS_DIR = BACKEND_DIR / "secrets"

ENV_PREFIX = "RAYAN_"


class RayyanSettings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com"
    gemini_timeout_seconds: float = 60.0
    # Bounds the TCP/TLS connection phase separately from a slow generation.
    gemini_connect_timeout_seconds: float = 10.0
    # Per-candidate budget for the one-token generation probe.
    gemini_probe_timeout_seconds: float = 10.0
    # Total wall-clock check for a validation call (model listing).
    gemini_validation_timeout_seconds: float = 30.0
    encryption_key: str = ""
    keyfile_path: str = str(SECRETS_DIR / "rayyan_api_keys.key")
    settings_token: str = ""
    max_requests_per_hour: int = 20
    max_keys: int = 10
    model_cache_seconds: int = 600
    # Upper bound on the answer length the model is asked for, and the hard
    # limit enforced after generation.
    max_output_tokens: int = 900
    max_answer_words: int = 320

    model_config = SettingsConfigDict(
        env_prefix=ENV_PREFIX,
        env_file=(PROJECT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def keyfile(self) -> Path:
        return Path(self.keyfile_path)

    @property
    def bootstrap_configured(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def token_required(self) -> bool:
        return bool(self.settings_token.strip())


@lru_cache
def get_rayyan_settings() -> RayyanSettings:
    """Cached settings; tests clear it with `get_rayyan_settings.cache_clear()`."""
    return RayyanSettings()
