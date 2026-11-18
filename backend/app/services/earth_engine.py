"""Google Earth Engine authentication and tile helpers.

The `earthengine-api` package is imported lazily so the rest of the API keeps
working when GEE is not installed or not configured. Every failure mode raises
`GEEUnavailable` with a safe, user-facing message — credentials, file paths and
provider tracebacks never reach the client.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any

from app.config import BACKEND_DIR, PROJECT_DIR, get_settings
from app.exceptions import GEEUnavailable

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_initialized = False


def is_configured() -> bool:
    return get_settings().gee_configured


def _resolve_key_file(raw: str) -> Path:
    path = Path(raw.strip()).expanduser()
    if path.is_absolute():
        return path
    for base in (PROJECT_DIR, BACKEND_DIR):
        candidate = base / path
        if candidate.exists():
            return candidate
    return PROJECT_DIR / path


def _build_credentials(ee: Any) -> Any:
    settings = get_settings()
    account = settings.gee_service_account.strip()
    if settings.gee_private_key_file.strip():
        key_file = _resolve_key_file(settings.gee_private_key_file)
        if not key_file.exists():
            raise GEEUnavailable(
                "The Earth Engine service-account key file was not found on the server.",
                details="GEE_NOT_CONFIGURED",
            )
        return ee.ServiceAccountCredentials(account, key_file=str(key_file))
    if settings.gee_private_key_json.strip():
        try:
            key_data = json.loads(settings.gee_private_key_json)
        except json.JSONDecodeError as exc:
            raise GEEUnavailable(
                "The Earth Engine service-account key is not valid JSON.",
                details="GEE_NOT_CONFIGURED",
            ) from exc
        return ee.ServiceAccountCredentials(account, key_data=json.dumps(key_data))
    raise GEEUnavailable(
        "Earth Engine credentials are not configured on the server.",
        details="GEE_NOT_CONFIGURED",
    )


def initialize() -> Any:
    """Return the initialised `ee` module, or raise `GEEUnavailable`.

    Initialisation runs once per process. A failure is not cached, so fixing
    credentials and reloading the API recovers without a restart.
    """
    global _initialized
    with _lock:
        if _initialized:
            import ee  # local import: only needed once configured

            return ee

        if not is_configured():
            raise GEEUnavailable(
                "Satellite analysis is not configured on this server. "
                "Add Earth Engine service-account credentials to enable it.",
                details="GEE_NOT_CONFIGURED",
            )

        try:
            import ee
        except ImportError as exc:
            logger.warning("earthengine-api is not installed: %s", exc)
            raise GEEUnavailable(
                "The Earth Engine client library is not installed on the server.",
                details="GEE_NOT_INSTALLED",
            ) from exc

        try:
            credentials = _build_credentials(ee)
            ee.Initialize(credentials, project=get_settings().gee_project.strip())
        except GEEUnavailable:
            raise
        except Exception as exc:  # provider errors may contain credential details
            logger.warning("Earth Engine initialisation failed: %s", type(exc).__name__)
            raise GEEUnavailable(
                "Earth Engine authentication failed. Check the service-account "
                "credentials and project registration.",
                details="GEE_AUTH_FAILED",
            ) from exc

        _initialized = True
        logger.info("Earth Engine initialised for project %s", get_settings().gee_project)
        return ee


def refresh() -> Any:
    """Re-initialise the client so a stale permission check can be re-evaluated.

    Google sometimes answers a fresh request with a project-permission denial
    while an IAM grant propagates. The cached client keeps presenting the same
    session, so minting new credentials gives the retry a fresh authorisation
    check instead of repeating the stale one.
    """
    global _initialized
    with _lock:
        _initialized = False
    return initialize()


def tile_url(image: Any, vis_params: dict[str, Any], layer_name: str) -> str:
    """Return the XYZ tile URL template for an image, or raise `GEEUnavailable`."""
    try:
        map_id = image.getMapId(vis_params)
        url = map_id["tile_fetcher"].url_format
    except Exception as exc:
        logger.warning("Earth Engine getMapId failed for %s: %s", layer_name, type(exc).__name__)
        raise GEEUnavailable(
            f"Earth Engine could not produce tiles for the {layer_name} layer.",
            details="GEE_TILES",
        ) from exc
    if not url:
        raise GEEUnavailable(
            f"Earth Engine returned no tile URL for the {layer_name} layer.",
            details="GEE_TILES",
        )
    return str(url)
