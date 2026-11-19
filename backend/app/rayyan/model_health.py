"""
Central Gemini text-model eligibility and verification.

Only Gemini Flash and Flash-Lite text-generation models are eligible. A model is
considered healthy only after it has produced a real, non-empty generation. The
catalogue alone is never treated as proof: Google has listed broken aliases.

Probing is deliberately sequential and quota-aware:

* the saved/preferred pinned model is tried first; unversioned aliases such as
  `gemini-flash-latest` are ranked after concrete models because Google can
  move them to a model that is overloaded or unresponsive;
* probing stops at the first successful generation;
* a model-specific 404/unsupported error, or an explicit "this model is over
  capacity" 503, may continue to the next candidate;
* quota, authentication, rate-limit, connectivity, timeout, every other HTTP
  5xx and unclassified failures stop immediately.

A successful verification is cached for exactly 600 seconds, scoped to the
credential fingerprint and selected model. The raw API key is never used as a
cache identifier and never stored in the cache.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

from app.rayyan.errors import (
    KeyInvalidError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    QuotaExceededError,
    UnsupportedModelError,
)
from app.rayyan.gemini import GeminiCallError

logger = logging.getLogger(__name__)

VERIFIED_MODEL_TTL_SECONDS = 600
PROBE_LIMIT = 5
PROBE_MAX_OUTPUT_TOKENS = 16
PROBE_SYSTEM = (
    "You are a connectivity check for AgriNASA Fale7. "
    "Answer the test prompt with one short word."
)
PROBE_USER = "Reply with OK and nothing else."

# A failed candidate may only be skipped when Google clearly attributes the
# failure to that individual model. Everything else stops the probe loop.
CONTINUE_CODES = frozenset(
    {
        "GEMINI_MODEL_NOT_FOUND",
        "GEMINI_MODEL_UNSUPPORTED",
        "GEMINI_MODEL_OVERLOADED",
    }
)
STOP_CODES = frozenset(
    {
        "GEMINI_KEY_INVALID",
        "GEMINI_QUOTA_EXCEEDED",
        "GEMINI_RATE_LIMITED",
        "GEMINI_UNREACHABLE",
        "GEMINI_CONNECT_TIMEOUT",
        "GEMINI_TIMEOUT",
        "GEMINI_UNAVAILABLE",
        "GEMINI_BAD_REQUEST",
        "GEMINI_BAD_RESPONSE",
        "GEMINI_GENERATION_FAILED",
        "GEMINI_EMPTY_RESPONSE",
        "GEMINI_RESPONSE_BLOCKED",
        "GEMINI_ERROR",
        "GEMINI_PROBE_FAILED",
        "GEMINI_NO_MODELS",
    }
)

# Model families that are not plain text generation. Anything that is not a
# Flash/Flash-Lite text model is excluded before it can be probed or selected.
_NON_TEXT_MARKERS = (
    "tts",
    "image",
    "imagen",
    "audio",
    "live",
    "lyria",
    "veo",
    "video",
    "embedding",
    "transcribe",
    "robotics",
    "computer-use",
    "computer_use",
    "deep-research",
    "deep_research",
    "antigravity",
    "nano-banana",
    "nano_banana",
)
_PRO_WORD = re.compile(r"(^|[^a-z])pro([^a-z]|$)")


def normalize_model(model: str | None) -> str:
    return (model or "").strip().removeprefix("models/")


def is_eligible_model(model: str | None) -> bool:
    """True only for Gemini Flash / Flash-Lite text-generation models."""
    name = normalize_model(model).lower()
    if not name or "flash" not in name:
        return False
    if _PRO_WORD.search(name):
        return False
    return not any(marker in name for marker in _NON_TEXT_MARKERS)


def eligible_models(available: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in available:
        name = normalize_model(raw)
        if name and is_eligible_model(name) and name not in seen:
            seen.add(name)
            result.append(name)
    return result


def is_pinned_model(model: str | None) -> bool:
    """True for concrete model versions; False for moving aliases like `-latest`."""
    return bool(re.search(r"\d", normalize_model(model)))


def _version_rank(name: str) -> tuple[float, float]:
    values = [float(value) for value in re.findall(r"\d+(?:\.\d+)?", name)[:2]]
    return tuple(values + [0.0] * (2 - len(values)))  # type: ignore[return-value]


def _candidate_key(name: str) -> tuple[int, int, int, float, float, str]:
    lower = name.lower()
    preview = 1 if ("preview" in lower or "exp" in lower) else 0
    alias = 1 if not re.search(r"\d", lower) else 0
    # Stable Flash-Lite first (lighter and less quota-hungry), then stable
    # Flash, then unversioned aliases, then previews; newest version first
    # inside each group. An overloaded Flash family cannot block Lite.
    lite = 0 if "lite" in lower else 1
    major, minor = _version_rank(lower)
    return (preview, alias, lite, -major, -minor, lower)


def ranked_candidates(
    available: list[str],
    preferred: str | None = None,
    limit: int = PROBE_LIMIT,
    *,
    pin_preferred: bool = False,
) -> list[str]:
    """Eligible candidates in verification order.

    A pinned preferred model goes first. A preferred alias goes first only when
    the caller explicitly pins it (manual model selection); otherwise concrete
    models are tried first because aliases can shift to a broken model.
    """
    models = eligible_models(available)
    first = normalize_model(preferred)
    ordered: list[str] = []
    if first and first in models and (pin_preferred or is_pinned_model(first)):
        ordered.append(first)
    ordered.extend(name for name in sorted(models, key=_candidate_key) if name != first)
    return ordered[: max(1, int(limit))]


@dataclass
class ModelProbe:
    model: str
    ok: bool
    code: str | None = None
    message: str = ""
    latency_ms: int = 0
    retry_after: str | None = None


@dataclass
class Verification:
    model: str | None
    probes: list[ModelProbe]
    cache_hit: bool = False


def _elapsed_ms(started: float) -> int:
    return max(0, int((time.monotonic() - started) * 1000))


async def probe_model(
    client: Any, model: str, *, timeout: float = 10.0
) -> ModelProbe:
    """Run one real generation test with a wall-clock deadline."""
    started = time.monotonic()
    budget = max(1.0, float(timeout))
    try:
        # The client's read timeout is `budget`; this outer deadline also caps
        # connect + write + a possible route fallback. It is never unbounded.
        result = await asyncio.wait_for(
            client.probe_generate(
                model=model,
                timeout=budget,
                system=PROBE_SYSTEM,
                user=PROBE_USER,
                max_output_tokens=PROBE_MAX_OUTPUT_TOKENS,
            ),
            timeout=budget + 1.0,
        )
    except asyncio.TimeoutError:
        return ModelProbe(
            model=model,
            ok=False,
            code="GEMINI_TIMEOUT",
            message=(
                "The model verification test exceeded its total deadline. "
                "The saved key and model were not changed."
            ),
            latency_ms=_elapsed_ms(started),
        )
    except GeminiCallError as exc:
        return ModelProbe(
            model=model,
            ok=False,
            code=exc.code,
            message=exc.message,
            latency_ms=_elapsed_ms(started),
            retry_after=exc.retry_after,
        )
    except Exception as exc:  # noqa: BLE001 — an unknown failure must stop probing
        logger.warning(
            "Gemini model verification failed unexpectedly: model=%s error=%s",
            model,
            type(exc).__name__,
        )
        return ModelProbe(
            model=model,
            ok=False,
            code="GEMINI_PROBE_FAILED",
            message="The model verification test failed unexpectedly; no unverified model was used.",
            latency_ms=_elapsed_ms(started),
        )

    text = (getattr(result, "text", "") or "").strip()
    if not text:
        return ModelProbe(
            model=model,
            ok=False,
            code="GEMINI_EMPTY_RESPONSE",
            message="The model returned no text during verification, so it was not treated as healthy.",
            latency_ms=_elapsed_ms(started),
        )
    return ModelProbe(model=model, ok=True, latency_ms=_elapsed_ms(started))


async def find_working_model(
    client: Any,
    available: list[str],
    *,
    preferred: str | None = None,
    timeout: float = 10.0,
    limit: int = PROBE_LIMIT,
    pin_preferred: bool = False,
) -> tuple[str | None, list[ModelProbe]]:
    """Probe sequentially, stopping at the first success or unsafe failure."""
    probes: list[ModelProbe] = []
    for model in ranked_candidates(
        available, preferred, limit, pin_preferred=pin_preferred
    ):
        probe = await probe_model(client, model, timeout=timeout)
        probes.append(probe)
        if probe.ok:
            return model, probes
        if probe.code not in CONTINUE_CODES:
            if probe.code not in STOP_CODES:
                logger.warning(
                    "Unclassified Gemini probe failure; stopping. model=%s code=%s",
                    model,
                    probe.code,
                )
            break
    return None, probes


def probe_summary(probes: list[ModelProbe]) -> str:
    if not probes:
        return (
            "Google returned no eligible Gemini Flash or Flash-Lite text model for this key; "
            "no model was tested."
        )
    last = probes[-1]
    tested = ", ".join(probe.model for probe in probes)
    reason = last.code or "unknown failure"
    if last.message:
        reason = f"{reason}: {last.message}"
    return f"Eligible models tested sequentially: {tested}. Last result: {reason}."


def probe_failure(probes: list[ModelProbe], *, action: str = "") -> Exception:
    """Map the final probe result to an honest, actionable API error."""
    suffix = f" {action}" if action else ""
    summary = probe_summary(probes)
    last = probes[-1] if probes else None
    code = last.code if last else "GEMINI_NO_MODELS"

    if code == "GEMINI_KEY_INVALID":
        return KeyInvalidError(
            "Google Gemini rejected the API key during model verification.",
            details=summary + suffix,
        )
    if code == "GEMINI_QUOTA_EXCEEDED":
        details = (
            "The key is preserved and still active. Wait for the quota to reset or "
            "activate another valid saved key in Fale7 API settings."
        )
        if last is not None and last.retry_after:
            details = f"{details} Google suggests retrying after {last.retry_after}."
        return QuotaExceededError(
            "The active Google Gemini key has reached its quota or rate limit.",
            details=details + suffix,
        )
    if code == "GEMINI_TIMEOUT" or code == "GEMINI_CONNECT_TIMEOUT":
        return ProviderTimeoutError(
            "No Gemini Flash model answered the verification test in time.",
            details=(
                summary
                + " The saved key and model were not changed. If this persists, choose "
                "another eligible Gemini Flash model in Fale7 API settings."
                + suffix
            ),
        )
    if code == "GEMINI_MODEL_OVERLOADED":
        return ProviderUnavailableError(
            "Every eligible Gemini model tested is temporarily over capacity.",
            details=(
                summary
                + " No unverified model was used. Try again later; the saved key and "
                "model were not changed."
                + suffix
            ),
        )
    if code in CONTINUE_CODES:
        return UnsupportedModelError(
            "The selected Gemini model is not available to this key.",
            details=summary + suffix,
        )
    return ProviderUnavailableError(
        "No eligible Gemini Flash or Flash-Lite model produced a verified test answer.",
        details=summary + " No unverified model was used." + suffix,
    )


class VerifiedModelCache:
    """In-process cache of models that produced a real generation."""

    def __init__(self, ttl_seconds: int = VERIFIED_MODEL_TTL_SECONDS) -> None:
        self.ttl_seconds = ttl_seconds
        self._entries: dict[tuple[str, str], tuple[float, str]] = {}
        self._inflight: dict[tuple[str, str, str], asyncio.Future[Verification]] = {}
        self._generation = 0

    @staticmethod
    def _fingerprint(api_key: str) -> str:
        return hashlib.sha256(f"rayyan-model-cache:{api_key}".encode("utf-8")).hexdigest()

    def get(self, key_id: str, api_key: str, preferred: str | None = None) -> str | None:
        identity = (key_id, self._fingerprint(api_key))
        entry = self._entries.get(identity)
        if entry is None:
            return None
        stored_at, model = entry
        if time.monotonic() - stored_at >= self.ttl_seconds:
            self._entries.pop(identity, None)
            return None
        if not is_eligible_model(model):
            self._entries.pop(identity, None)
            return None
        wanted = normalize_model(preferred)
        if wanted and wanted != model:
            return None
        return model

    def put(self, key_id: str, api_key: str, model: str) -> None:
        name = normalize_model(model)
        if is_eligible_model(name):
            self._entries[(key_id, self._fingerprint(api_key))] = (time.monotonic(), name)

    def invalidate(self, key_id: str) -> None:
        for identity in [identity for identity in self._entries if identity[0] == key_id]:
            self._entries.pop(identity, None)
        # Also stop any concurrent probe for this credential from repopulating
        # the cache after the invalidation point.
        self._generation += 1

    def invalidate_all(self) -> None:
        self._entries.clear()
        self._generation += 1

    def clear(self) -> None:
        self.invalidate_all()

    def size(self) -> int:
        return len(self._entries)

    async def verify(
        self,
        client: Any,
        key_id: str,
        api_key: str,
        available: list[str],
        *,
        preferred: str | None = None,
        timeout: float = 10.0,
        limit: int = PROBE_LIMIT,
        pin_preferred: bool = False,
    ) -> Verification:
        cached = self.get(key_id, api_key, preferred)
        if cached:
            return Verification(model=cached, probes=[], cache_hit=True)

        fingerprint = self._fingerprint(api_key)
        inflight_key = (
            key_id,
            fingerprint,
            normalize_model(preferred),
            1 if pin_preferred else 0,
        )
        existing = self._inflight.get(inflight_key)
        if existing is not None:
            return await asyncio.shield(existing)

        loop = asyncio.get_running_loop()
        future: asyncio.Future[Verification] = loop.create_future()
        self._inflight[inflight_key] = future
        generation = self._generation
        try:
            model, probes = await find_working_model(
                client,
                available,
                preferred=preferred,
                timeout=timeout,
                limit=limit,
                pin_preferred=pin_preferred,
            )
            result = Verification(model=model, probes=probes)
            if model and self._generation == generation:
                self.put(key_id, api_key, model)
            future.set_result(result)
            return result
        except BaseException as exc:
            if not future.done():
                future.set_exception(exc)
                future.exception()
            raise
        finally:
            self._inflight.pop(inflight_key, None)


verified_models = VerifiedModelCache()
