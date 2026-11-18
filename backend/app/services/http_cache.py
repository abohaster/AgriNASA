"""Disk-backed JSON cache for keyless public APIs.

Public scientific endpoints are rate-limited and slow. Every explorer request
therefore goes through this cache: identical queries reuse a JSON file under
``backend/data/cache`` until the TTL expires. The file stores the fetch time so
the UI can show how old a value is, and writes are atomic so a crash never
leaves a half-written cache entry.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_memory: dict[str, tuple[float, Any]] = {}
_lock = threading.Lock()
USER_AGENT = "AgriNASA/1.0 (educational crop decision-support project)"


def _cache_path(namespace: str, key: str) -> Path:
    root = Path(get_settings().explore_cache_dir) / namespace
    root.mkdir(parents=True, exist_ok=True)
    return root / f"{key}.json"


def _key_material(params: dict[str, Any] | list[tuple[str, str]]) -> str:
    """Stable key for dicts and for lists with repeated parameter names."""
    if isinstance(params, dict):
        return json.dumps(params, sort_keys=True, default=str)
    return json.dumps(sorted(params), default=str)


def cached_get_json(
    url: str,
    params: dict[str, Any] | list[tuple[str, str]],
    *,
    namespace: str,
    ttl_seconds: int,
    timeout_seconds: float,
    prefer_direct: bool = False,
) -> tuple[Any, float]:
    """Return ``(payload, fetched_at_epoch)``, fetching only when stale.

    Provider errors propagate as ``httpx`` exceptions; callers decide whether a
    section is unavailable or whether an older cached value is still useful.

    ``prefer_direct`` tries the provider without environment proxies first. Some
    slow public science hosts stall behind a desktop proxy that other APIs do
    not use; retrying directly recovers without affecting proxied networks,
    where the direct attempt simply fails fast and the proxied attempt runs.
    """
    digest = hashlib.sha1(
        (url + _key_material(params)).encode("utf-8")
    ).hexdigest()
    now = time.time()

    with _lock:
        memory_hit = _memory.get(digest)
    if memory_hit and now - memory_hit[0] <= ttl_seconds:
        return memory_hit[1], memory_hit[0]

    path = _cache_path(namespace, digest)
    if path.is_file():
        try:
            stored = json.loads(path.read_text(encoding="utf-8"))
            fetched_at = float(stored["fetched_at"])
            if now - fetched_at <= ttl_seconds:
                payload = stored["payload"]
                with _lock:
                    _memory[digest] = (fetched_at, payload)
                return payload, fetched_at
        except (OSError, ValueError, KeyError):
            logger.debug("Ignoring unreadable cache entry %s", path)

    def fetch(trust_env: bool) -> Any:
        timeout = httpx.Timeout(timeout_seconds, connect=min(8.0, timeout_seconds))
        with httpx.Client(
            timeout=timeout, headers={"User-Agent": USER_AGENT}, trust_env=trust_env
        ) as client:
            response = client.get(url, params=params)
        response.raise_for_status()
        return response.json()

    attempts = (False, True) if prefer_direct else (True,)
    payload: Any = None
    last_error: Exception | None = None
    for trust_env in attempts:
        try:
            payload = fetch(trust_env)
            break
        except (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError) as exc:
            last_error = exc
            logger.debug(
                "Request to %s failed (proxied=%s): %s", url, trust_env, type(exc).__name__
            )
    if payload is None:
        assert last_error is not None
        raise last_error

    fetched_at = time.time()
    try:
        temp_path = path.with_suffix(".tmp")
        temp_path.write_text(
            json.dumps({"fetched_at": fetched_at, "payload": payload}, ensure_ascii=False),
            encoding="utf-8",
        )
        os.replace(temp_path, path)
    except OSError as exc:
        logger.warning("Could not write cache file %s: %s", path, type(exc).__name__)

    with _lock:
        _memory[digest] = (fetched_at, payload)
    return payload, fetched_at
