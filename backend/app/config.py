"""
Application configuration, loaded from environment variables / .env files.

Nothing here talks to the internet. Every optional integration (LLM, Earth
Engine) degrades gracefully when its credentials are absent — see the properties
at the bottom of the class. Real secrets belong in `.env`, never in code or git.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent

# httpx parses every NO_PROXY entry as a URL; bracketed IPv6 entries such as
# "[::1]" raise InvalidURL and break all outbound HTTP clients. Drop only the
# entries httpx cannot parse and keep the rest of the list intact.
for _proxy_var in ("NO_PROXY", "no_proxy"):
    _raw = os.environ.get(_proxy_var)
    if _raw:
        _kept = [entry for entry in (part.strip() for part in _raw.split(",")) if entry and "[" not in entry]
        os.environ[_proxy_var] = ",".join(_kept)


class Settings(BaseSettings):
    # ── Application ──────────────────────────────────────────────────────
    app_name: str = "AgriNASA API"
    app_version: str = "1.0.0"
    environment: Literal["development", "test", "production"] = "development"

    # "live" calls NASA POWER; "demo" replays the cached snapshot for *every*
    # request. Demo can also be enabled per request with ?mode=demo.
    data_mode: Literal["live", "demo"] = "live"

    # SQLite for the initial version. Example for PostgreSQL:
    # postgresql+psycopg://user:password@localhost:5432/agrinasa
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'agrinasa.db').as_posix()}"

    # Comma-separated list used by CORS. The Vite dev server runs on 5173.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ── NASA POWER (no API key required) ────────────────────────────────
    nasa_power_base_url: str = "https://power.larc.nasa.gov/api/temporal"
    nasa_timeout_seconds: float = 30.0
    nasa_cache_ttl_seconds: int = 6 * 60 * 60  # 6 hours
    nasa_max_series_days: int = 366

    # ── Geocoding proxy (Nominatim public service) ───────────────────────
    geocoding_base_url: str = "https://nominatim.openstreetmap.org"
    geocoding_user_agent: str = "AgriNASA/1.0 (student educational project)"
    geocoding_timeout_seconds: float = 10.0

    # ── Weather forecast (Open-Meteo, keyless) ───────────────────────────
    # NASA POWER has no forecast product. The farmer guide asks Open-Meteo for
    # a short daily outlook; failures leave the forecast unavailable, never
    # fabricated.
    forecast_base_url: str = "https://api.open-meteo.com/v1"
    forecast_timeout_seconds: float = 10.0

    # ── Open-Meteo current weather + historical archive ──────────────────
    # The archive is ERA5 / ERA5-Land reanalysis (1940 → a few days behind
    # real time); "current" is the model's latest analysis + forecast step.
    open_meteo_archive_base_url: str = "https://archive-api.open-meteo.com/v1"
    open_meteo_timeout_seconds: float = 25.0
    # Long-term baseline used by the historical comparisons (inclusive years).
    climate_baseline_start: int = 1991
    climate_baseline_end: int = 2020
    history_default_years: int = 5

    # ── ISRIC SoilGrids (modeled soil properties, keyless) ──────────────
    # SoilGrids is a global 250 m machine-learning product, not a soil test.
    soilgrids_base_url: str = "https://rest.isric.org/soilgrids/v2.0"
    soilgrids_timeout_seconds: float = 90.0

    # ── Explore cache ────────────────────────────────────────────────────
    # Responses are cached on disk (JSON) so repeated map clicks and history
    # requests do not hammer public APIs.
    explore_cache_dir: str = str(BACKEND_DIR / "data" / "cache")
    explore_cache_ttl_seconds: int = 30 * 60
    history_cache_ttl_seconds: int = 12 * 60 * 60

    # ── FAO WaPOR (optional, registration required) ──────────────────────
    # WaPOR needs a personal API token from https://data.apps.fao.org/wapor.
    # Leave empty: the app then reports WaPOR as not configured and uses
    # Open-Meteo / NASA POWER evapotranspiration instead. See README.
    wapor_token: str = ""
    wapor_timeout_seconds: float = 25.0

    # ── AI assistant (OpenAI-compatible endpoint) ────────────────────────
    # Leave AI_API_KEY empty to use the deterministic rule-based explainer.
    ai_base_url: str = "https://api.openai.com/v1"
    ai_api_key: str = ""
    ai_model: str = "gpt-4o-mini"
    ai_timeout_seconds: float = 45.0
    ai_max_requests_per_hour: int = 30

    # ── Google Earth Engine (optional satellite analysis + NDVI) ─────────
    # Also serves the vegetation index endpoint (Sentinel-2 NDVI/NDMI); no
    # separate Earthdata/AppEEARS provider is needed.
    # Service-account credentials only. Keys live in .env or a git-ignored
    # JSON file; they are never sent to the browser.
    gee_service_account: str = ""
    gee_project: str = ""
    gee_private_key_file: str = ""
    # Alternative to a file: the full JSON key as one environment value.
    gee_private_key_json: str = ""
    gee_cache_ttl_seconds: int = 30 * 60
    gee_max_date_range_days: int = 90

    # ── Demo snapshot ────────────────────────────────────────────────────
    demo_snapshot_path: str = str(BACKEND_DIR / "app" / "demo" / "qena_power_snapshot.json")

    # Create the four demo-trial fields at startup (hosted demo deployments).
    seed_demo_trials: bool = False

    # Built SPA directory served by FastAPI in single-container deployments.
    frontend_dist: str = str(PROJECT_DIR / "frontend" / "dist")

    model_config = SettingsConfigDict(
        env_file=(PROJECT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator("cors_origins")
    @classmethod
    def _strip_origins(cls, value: str) -> str:
        return ",".join(origin.strip() for origin in value.split(",") if origin.strip())

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin for origin in self.cors_origins.split(",") if origin]

    @property
    def ai_configured(self) -> bool:
        return bool(self.ai_api_key.strip())

    @property
    def vegetation_configured(self) -> bool:
        """NDVI/NDMI come from Sentinel-2 through the same Earth Engine project."""
        return self.gee_configured

    @property
    def gee_configured(self) -> bool:
        """True only when a service account, project and key material exist."""
        has_key = bool(self.gee_private_key_file.strip()) or bool(self.gee_private_key_json.strip())
        return bool(self.gee_service_account.strip()) and bool(self.gee_project.strip()) and has_key

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def sqlite_path(self) -> Path | None:
        """Extract the file path so we can create its parent directory."""
        if not self.is_sqlite:
            return None
        raw = self.database_url.split("sqlite:///", 1)[-1]
        return Path(raw)

    @property
    def demo_snapshot_file(self) -> Path:
        return Path(self.demo_snapshot_path)


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance; tests can clear it with get_settings.cache_clear()."""
    return Settings()
