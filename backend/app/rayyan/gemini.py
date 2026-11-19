"""
Google Gemini client.

Only this module talks to Google. The browser never sees the API key or the
provider response envelope.

API choice
----------
Current Gemini documentation recommends the Interactions API
(`POST /v1beta/interactions`) and keeps `generateContent` available for
compatibility. This client uses Interactions first and falls back to
`generateContent` only when the Interactions route itself is absent (HTTP 404
for the route, not for a model). Model identifiers are never hardcoded as the
only option: they are read from `GET /v1beta/models` for the active key.

Errors are normalised into `GeminiCallError` with a stable code. Provider error
text is truncated and redacted before it can reach a log or the browser.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com"
_SECRET_QUERY = re.compile(r"(?i)([?&](?:key|api_key)=)[^&\s]+")


class GeminiCallError(Exception):
    """Normalised provider failure. `message` is safe for the browser."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status: int | None = None,
        provider_message: str = "",
        retry_after: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.provider_message = provider_message
        self.retry_after = retry_after


class _InteractionsRouteMissing(GeminiCallError):
    def __init__(self, provider_message: str = "") -> None:
        super().__init__(
            "GEMINI_ROUTE_MISSING",
            "The Interactions API route is not available; falling back.",
            status=404,
            provider_message=provider_message,
        )


@dataclass
class ValidationOutcome:
    valid: bool
    status: str  # valid | invalid | quota_limited | error
    code: str | None
    message: str
    models: list[str] = field(default_factory=list)
    provider_message: str = ""


@dataclass
class GenerationResult:
    text: str
    model: str
    usage: dict | None
    api: str


class ModelDirectory:
    """Small in-process cache so the settings page does not hammer the API."""

    def __init__(self, ttl_seconds: int = 600) -> None:
        self.ttl_seconds = ttl_seconds
        self._entries: dict[str, tuple[float, list[str]]] = {}

    def get(self, key_id: str) -> list[str] | None:
        entry = self._entries.get(key_id)
        if entry is None:
            return None
        stored_at, models = entry
        if time.monotonic() - stored_at > self.ttl_seconds:
            self._entries.pop(key_id, None)
            return None
        return list(models)

    def put(self, key_id: str, models: list[str]) -> None:
        self._entries[key_id] = (time.monotonic(), list(models))

    def invalidate(self, key_id: str) -> None:
        self._entries.pop(key_id, None)

    def clear(self) -> None:
        self._entries.clear()


directory = ModelDirectory()

# Test-only seam: an httpx.MockTransport injected before creating a client.
# Production code never sets this.
_TRANSPORT_OVERRIDE: httpx.AsyncBaseTransport | None = None


def set_transport_override(transport: httpx.AsyncBaseTransport | None) -> None:
    global _TRANSPORT_OVERRIDE
    _TRANSPORT_OVERRIDE = transport


def redact(text: str, secret: str = "") -> str:
    cleaned = _SECRET_QUERY.sub(r"\1[redacted]", text or "")
    if secret:
        cleaned = cleaned.replace(secret, "[redacted]")
    return cleaned.strip()


class GeminiClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 60.0,
        connect_timeout: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._connect_timeout = connect_timeout
        self._transport = transport or _TRANSPORT_OVERRIDE

    # ── transport ──────────────────────────────────────────────────────
    def _client(self) -> httpx.AsyncClient:
        headers = {
            "x-goog-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        timeout = httpx.Timeout(
            connect=min(self._connect_timeout, self._timeout),
            read=self._timeout,
            write=min(15.0, self._timeout),
            pool=min(10.0, self._timeout),
        )
        return httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
            headers=headers,
            transport=self._transport,
            # Ambient proxy variables are deliberately ignored: a malformed
            # NO_PROXY entry (e.g. "[::1]") aborts client construction, and
            # Gemini traffic is expected to leave directly from the backend.
            trust_env=False,
        )

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        try:
            client = self._client()
        except Exception as exc:
            # A malformed proxy/URL environment must surface as a configuration
            # error the user can see, never as an unhandled 500.
            logger.warning("Gemini client setup failed: %s", type(exc).__name__)
            raise GeminiCallError(
                "GEMINI_UNREACHABLE",
                "The backend could not prepare a connection to Google Gemini. "
                "Check the server's network configuration and try again.",
            ) from exc

        async with client as client:
            try:
                response = await client.request(method, path, json=json, params=params)
            except httpx.ConnectTimeout as exc:
                logger.warning("Gemini connection timed out: path=%s", path)
                raise GeminiCallError(
                    "GEMINI_CONNECT_TIMEOUT",
                    "The backend could not connect to Google Gemini in time. Check the "
                    "server's internet connection and try again.",
                ) from exc
            except httpx.TimeoutException as exc:
                logger.warning("Gemini request timed out: path=%s", path)
                raise GeminiCallError(
                    "GEMINI_TIMEOUT",
                    "Google Gemini did not respond in time. Try again, or switch keys "
                    "in Fale7 API settings if the problem persists.",
                ) from exc
            except (httpx.HTTPError, httpx.InvalidURL) as exc:
                logger.warning("Gemini connection failed: path=%s error=%s", path, type(exc).__name__)
                raise GeminiCallError(
                    "GEMINI_UNREACHABLE",
                    "The backend could not reach Google Gemini. Check the server's internet "
                    "connection and try again.",
                ) from exc

        if response.status_code >= 400:
            raise self._error_from_response(response)
        try:
            return response.json()
        except ValueError as exc:
            raise GeminiCallError(
                "GEMINI_BAD_RESPONSE",
                "Google Gemini returned a response that could not be read. No values were invented.",
                status=response.status_code,
            ) from exc

    # ── models ─────────────────────────────────────────────────────────
    async def list_models(self) -> list[str]:
        models: list[str] = []
        page_token: str | None = None
        for _ in range(5):
            params: dict[str, str | int] = {"pageSize": 1000}
            if page_token:
                params["pageToken"] = page_token
            payload = await self._request("GET", "/v1beta/models", params=params)
            for entry in payload.get("models", []) or []:
                name = str(entry.get("name", ""))
                name = name.removeprefix("models/")
                methods = entry.get("supportedGenerationMethods") or []
                if name and "generateContent" in methods and name not in models:
                    models.append(name)
            page_token = payload.get("nextPageToken")
            if not page_token:
                break
        if not models:
            raise GeminiCallError(
                "GEMINI_NO_MODELS",
                "This key returned no Gemini model that supports text generation. "
                "Check that the Gemini API is enabled for the key's Google Cloud project.",
            )
        return models

    async def validate(self) -> ValidationOutcome:
        try:
            models = await self.list_models()
        except GeminiCallError as exc:
            if exc.code == "GEMINI_QUOTA_EXCEEDED":
                return ValidationOutcome(
                    valid=False,
                    status="quota_limited",
                    code=exc.code,
                    message=exc.message,
                    provider_message=exc.provider_message,
                )
            if exc.code == "GEMINI_KEY_INVALID":
                return ValidationOutcome(
                    valid=False,
                    status="invalid",
                    code=exc.code,
                    message=exc.message,
                    provider_message=exc.provider_message,
                )
            # A timeout, outage or missing-model catalogue does not prove the
            # key is invalid. Leave its saved state untouched.
            return ValidationOutcome(
                valid=False,
                status="error",
                code=exc.code,
                message=exc.message,
                provider_message=exc.provider_message,
            )
        return ValidationOutcome(
            valid=True,
            status="valid",
            code=None,
            message=(
                "Key validated. Google Gemini accepted it and returned "
                f"{len(models)} text model(s)."
            ),
            models=models,
        )

    # ── generation ─────────────────────────────────────────────────────
    async def generate(
        self,
        *,
        model: str,
        system: str,
        user: str,
        max_output_tokens: int = 900,
    ) -> GenerationResult:
        try:
            return await self._generate_interactions(
                model=model,
                system=system,
                user=user,
                max_output_tokens=max_output_tokens,
            )
        except _InteractionsRouteMissing:
            logger.info("Interactions route unavailable; using generateContent compatibility route")
            return await self._generate_legacy(
                model=model,
                system=system,
                user=user,
                max_output_tokens=max_output_tokens,
            )

    async def generate_vision(
        self,
        *,
        model: str,
        system: str,
        prompt: str,
        images: list[dict[str, str]],
        max_output_tokens: int = 900,
    ) -> GenerationResult:
        """Multimodal generation used only by the server-side image review.

        `images` holds ``{"mime_type": ..., "data_base64": ...}`` entries. The
        bytes never leave the backend except inside this provider request.
        """
        parts: list[dict] = [{"text": prompt}]
        for image in images:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": image["mime_type"],
                        "data": image["data_base64"],
                    }
                }
            )
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"maxOutputTokens": max_output_tokens, "temperature": 0.2},
        }
        payload = await self._request(
            "POST", f"/v1beta/models/{model}:generateContent", json=body
        )
        feedback = payload.get("promptFeedback") or {}
        candidates = payload.get("candidates") or []
        if not candidates:
            reason = feedback.get("blockReason") or "no candidates"
            raise GeminiCallError(
                "GEMINI_RESPONSE_BLOCKED",
                f"Google Gemini returned no analysis ({redact(str(reason))[:120]}). "
                "Nothing was substituted.",
            )
        candidate = candidates[0]
        finish = str(candidate.get("finishReason", "")).upper()
        if finish in {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"}:
            raise GeminiCallError(
                "GEMINI_RESPONSE_BLOCKED",
                "Google Gemini blocked the image analysis. Nothing was substituted.",
            )
        parts_out = ((candidate.get("content") or {}).get("parts")) or []
        text = "\n".join(
            str(part.get("text", "")).strip()
            for part in parts_out
            if isinstance(part, dict) and part.get("text")
        ).strip()
        if not text:
            raise GeminiCallError(
                "GEMINI_EMPTY_RESPONSE",
                "Google Gemini returned no usable image analysis. Nothing was substituted.",
            )
        usage = payload.get("usageMetadata") if isinstance(payload.get("usageMetadata"), dict) else None
        return GenerationResult(text=text, model=model, usage=usage, api="generateContent")

    async def probe_generate(
        self,
        *,
        model: str,
        timeout: float,
        system: str,
        user: str,
        max_output_tokens: int = 16,
    ) -> GenerationResult:
        """One real generation through the same path used by production chat."""
        probe = GeminiClient(
            self._api_key,
            base_url=self._base_url,
            timeout=timeout,
            connect_timeout=self._connect_timeout,
            transport=self._transport,
        )
        return await probe.generate(
            model=model,
            system=system,
            user=user,
            max_output_tokens=max_output_tokens,
        )

    async def _generate_interactions(
        self,
        *,
        model: str,
        system: str,
        user: str,
        max_output_tokens: int,
    ) -> GenerationResult:
        body = {
            "model": model,
            "input": user,
            "system_instruction": system,
            "generation_config": {"max_output_tokens": max_output_tokens},
            "store": False,
        }
        # A 404 here can either mean "route missing" or "model missing".
        try:
            payload = await self._request("POST", "/v1beta/interactions", json=body)
        except GeminiCallError as exc:
            if exc.status == 404 and "model" not in (exc.provider_message or "").lower():
                raise _InteractionsRouteMissing(exc.provider_message) from exc
            raise

        status = str(payload.get("status", "")).lower()
        if status in {"failed", "cancelled"}:
            raise GeminiCallError(
                "GEMINI_GENERATION_FAILED",
                "Google Gemini reported that the request failed. Nothing was substituted.",
                provider_message=self._error_text(payload),
            )

        text = self._extract_interaction_text(payload)
        if not text:
            raise GeminiCallError(
                "GEMINI_EMPTY_RESPONSE",
                "Google Gemini returned no usable text. Nothing was substituted.",
                provider_message=self._error_text(payload),
            )
        usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else None
        return GenerationResult(text=text, model=model, usage=usage, api="interactions")

    async def _generate_legacy(
        self,
        *,
        model: str,
        system: str,
        user: str,
        max_output_tokens: int,
    ) -> GenerationResult:
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"maxOutputTokens": max_output_tokens},
        }
        payload = await self._request(
            "POST", f"/v1beta/models/{model}:generateContent", json=body
        )
        feedback = payload.get("promptFeedback") or {}
        candidates = payload.get("candidates") or []
        if not candidates:
            reason = feedback.get("blockReason") or "no candidates"
            raise GeminiCallError(
                "GEMINI_RESPONSE_BLOCKED",
                f"Google Gemini returned no answer ({redact(str(reason))[:120]}). "
                "Nothing was substituted.",
            )
        candidate = candidates[0]
        finish = str(candidate.get("finishReason", "")).upper()
        if finish in {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"}:
            raise GeminiCallError(
                "GEMINI_RESPONSE_BLOCKED",
                "Google Gemini blocked the answer. Nothing was substituted.",
            )
        parts = ((candidate.get("content") or {}).get("parts")) or []
        text = "\n".join(
            str(part.get("text", "")).strip()
            for part in parts
            if isinstance(part, dict) and part.get("text")
        ).strip()
        if not text:
            raise GeminiCallError(
                "GEMINI_EMPTY_RESPONSE",
                "Google Gemini returned no usable text. Nothing was substituted.",
            )
        usage = payload.get("usageMetadata") if isinstance(payload.get("usageMetadata"), dict) else None
        return GenerationResult(text=text, model=model, usage=usage, api="generateContent")

    @staticmethod
    def _extract_interaction_text(payload: dict) -> str:
        direct = payload.get("output_text")
        if isinstance(direct, str) and direct.strip():
            return direct.strip()
        chunks: list[str] = []
        for step in payload.get("steps", []) or []:
            if not isinstance(step, dict):
                continue
            if step.get("type") != "model_output":
                continue
            for item in step.get("content", []) or []:
                if isinstance(item, str):
                    chunks.append(item)
                elif isinstance(item, dict):
                    if item.get("type", "text") == "text" and item.get("text"):
                        chunks.append(str(item["text"]))
        return "\n".join(chunk.strip() for chunk in chunks if chunk.strip()).strip()

    @staticmethod
    def _error_text(payload: dict) -> str:
        error = payload.get("error") if isinstance(payload.get("error"), dict) else {}
        message = error.get("message") or payload.get("message") or ""
        return redact(str(message))[:240]

    # ── error mapping ──────────────────────────────────────────────────
    def _error_from_response(self, response: httpx.Response) -> GeminiCallError:
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        error = payload.get("error") if isinstance(payload.get("error"), dict) else {}
        provider_message = redact(str(error.get("message", "")), self._api_key)
        provider_status = str(error.get("status", "")).upper()
        status = response.status_code
        lowered = provider_message.lower()
        retry_after = self._retry_after(error)

        logger.warning(
            "Gemini request rejected: http_status=%s provider_status=%s",
            status,
            provider_status or "-",
        )

        if status in (401, 403) or "api key" in lowered and status == 400:
            return GeminiCallError(
                "GEMINI_KEY_INVALID",
                "Google Gemini rejected the API key. Check that the key is active and that "
                "the Gemini API is enabled, then validate or replace it in Fale7 API settings.",
                status=status,
                provider_message=provider_message,
            )
        if status == 429 or provider_status == "RESOURCE_EXHAUSTED":
            return GeminiCallError(
                "GEMINI_QUOTA_EXCEEDED",
                "The active Google Gemini key has reached its quota or rate limit. Activate "
                "another saved key, or wait for the quota to reset.",
                status=status,
                provider_message=provider_message,
                retry_after=retry_after,
            )
        if status == 404 or "model" in lowered and "not found" in lowered:
            return GeminiCallError(
                "GEMINI_MODEL_NOT_FOUND",
                "The selected Gemini model is not available to this key. Choose another model "
                "in Fale7 API settings.",
                status=status,
                provider_message=provider_message,
            )
        if status == 400 and any(
            marker in lowered
            for marker in ("not supported", "unsupported", "does not support", "no longer available")
        ):
            return GeminiCallError(
                "GEMINI_MODEL_NOT_FOUND",
                "The selected Gemini model is not supported for this key. Choose another model "
                "in Fale7 API settings.",
                status=status,
                provider_message=provider_message,
            )
        if status == 400:
            return GeminiCallError(
                "GEMINI_BAD_REQUEST",
                "Google Gemini rejected the request. The saved key was not changed.",
                status=status,
                provider_message=provider_message,
            )
        if status == 503 and any(
            marker in lowered
            for marker in ("high demand", "overloaded", "over capacity")
        ):
            # Google attributes this 503 to the individual model's capacity, not
            # to an account or API-wide outage. It is safe to test another
            # eligible model; every other 5xx still stops immediately.
            return GeminiCallError(
                "GEMINI_MODEL_OVERLOADED",
                "This Gemini model is temporarily over capacity (Google reported high "
                "demand). No answer was generated by it.",
                status=status,
                provider_message=provider_message,
            )
        if status >= 500:
            return GeminiCallError(
                "GEMINI_UNAVAILABLE",
                "Google Gemini is currently unavailable. The request was not answered by AI; "
                "no values were invented.",
                status=status,
                provider_message=provider_message,
            )
        return GeminiCallError(
            "GEMINI_ERROR",
            "Google Gemini could not complete the request.",
            status=status,
            provider_message=provider_message,
        )

    @staticmethod
    def _retry_after(error: dict) -> str | None:
        for detail in error.get("details", []) or []:
            if not isinstance(detail, dict):
                continue
            if str(detail.get("@type", "")).endswith("RetryInfo"):
                delay = detail.get("retryDelay")
                if delay:
                    return str(delay)[:40]
        return None
