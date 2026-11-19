"""
RAYAN API router.

Mounted at `/api/rayyan` in the isolated app; the same router can be included in
`app/main.py` once that one-line integration is approved.

Settings endpoints (key management) require either the configured
`RAYAN_SETTINGS_TOKEN` header or a loopback client. The chat/availability
endpoints are public but never return a key or a key hint beyond the masked
form stored at save time.
"""

from __future__ import annotations

import hmac
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.db.database import get_session
from app.exceptions import NotFoundError
from app.rayyan import keystore
from app.rayyan.capabilities import unavailable_ids
from app.rayyan.config import RayyanSettings, get_rayyan_settings
from app.rayyan.crypto import (
    DecryptionError,
    KeyCipher,
    mask_secret,
    validate_key_format,
)
from app.rayyan.data_access import build_capabilities, resolve_mode
from app.rayyan.errors import (
    KeyInvalidError,
    KeyLimitError,
    KeyNotActivatableError,
    KeyRejectedError,
    KeyStoreError,
    NoActiveKeyError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    QuotaExceededError,
    RateLimitedError,
    SettingsAuthError,
    UnsupportedModelError,
)
from app.rayyan.gemini import GeminiCallError, GeminiClient, directory
from app.rayyan.model_health import (
    PROBE_LIMIT,
    eligible_models,
    find_working_model,
    is_eligible_model,
    probe_failure,
    probe_summary,
    ranked_candidates,
    verified_models,
)
from app.rayyan.orchestrator import ask as ask_orchestrator
from app.rayyan.orchestrator import availability as availability_status
from app.rayyan.orchestrator import limiter
from app.rayyan.schemas import (
    AskRequest,
    AskResponse,
    AvailabilityResponse,
    CapabilitiesResponse,
    CapabilityOut,
    KeyCreate,
    KeyOut,
    KeyUpdate,
    ModelListResponse,
    SettingsStatus,
    ValidateResponse,
    key_out,
    key_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rayyan", tags=["rayyan"])

LOCAL_HOSTS = {"127.0.0.1", "::1", "localhost", "testclient"}


def _settings() -> RayyanSettings:
    return get_rayyan_settings()


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _auth_mode(settings: RayyanSettings) -> str:
    return "token" if settings.token_required else "loopback"


def require_settings_access(request: Request) -> None:
    """Admin guard for key management.

    With `RAYAN_SETTINGS_TOKEN` set, the exact header is required. Without it,
    only a client on the loopback interface may manage keys. A deployment on a
    shared host must set the token; this is reported to the user.
    """
    settings = _settings()
    if settings.token_required:
        supplied = request.headers.get("x-rayyan-settings-token", "")
        if not supplied or not hmac.compare_digest(supplied, settings.settings_token):
            raise SettingsAuthError(
                "API settings are protected.",
                details=(
                    "Send the settings token configured on the server in the "
                    "settings header."
                ),
            )
        return

    host = request.client.host if request.client else ""
    if host not in LOCAL_HOSTS:
        raise SettingsAuthError(
            "API settings are limited to this server.",
            details=(
                "Set the server settings token to allow remote management. "
                "Until then, add Gemini keys from the server itself."
            ),
            status_code=403,
        )


def _guard_settings_rate(request: Request) -> None:
    host = request.client.host if request.client else "local"
    if not limiter.allow(f"rayyan-settings:{host}", 60):
        raise RateLimitedError(
            "Too many API-settings requests from this client.",
            details="Wait an hour before trying again.",
        )


def _cipher(settings: RayyanSettings) -> KeyCipher:
    try:
        return KeyCipher.from_settings(settings)
    except Exception as exc:  # CipherConfigurationError is a CipherError
        raise KeyStoreError(str(exc)) from exc


def _decrypt(row, settings: RayyanSettings) -> str:
    try:
        return _cipher(settings).decrypt(row["ciphertext"])
    except DecryptionError as exc:
        raise KeyStoreError(
            str(exc),
            details="The stored ciphertext was preserved; delete and re-add the key.",
        ) from exc


def _get_row(session: Session, key_id: str):
    row = keystore.get_key(session, key_id)
    if row is None:
        raise NotFoundError(
            "Saved key not found.",
            details="It may have been deleted. Refresh Fale7 API settings.",
        )
    return row


def _client(api_key: str, settings: RayyanSettings) -> GeminiClient:
    return GeminiClient(
        api_key,
        base_url=settings.gemini_base_url,
        timeout=settings.gemini_validation_timeout_seconds,
        connect_timeout=settings.gemini_connect_timeout_seconds,
    )


async def _models_for(api_key: str, settings: RayyanSettings) -> list[str]:
    try:
        models = await _client(api_key, settings).list_models()
    except GeminiCallError as exc:
        raise _provider_error(exc) from exc
    return eligible_models(models)


def _provider_error(exc: GeminiCallError) -> Exception:
    if exc.code == "GEMINI_KEY_INVALID":
        return KeyInvalidError(
            "Google Gemini rejected this API key.",
            details=(
                "The key was not activated or saved. Check that the Gemini API is "
                "enabled for its Google Cloud project."
            ),
        )
    if exc.code == "GEMINI_QUOTA_EXCEEDED":
        return QuotaExceededError(
            "Google Gemini accepted the request but the key is over its quota.",
            details="Wait for the quota to reset or use another key.",
        )
    if exc.code in {"GEMINI_TIMEOUT", "GEMINI_CONNECT_TIMEOUT"}:
        return ProviderTimeoutError(
            "Google Gemini did not respond in time.",
            details="The saved key and model were not changed.",
        )
    return ProviderUnavailableError(
        exc.message,
        details="Google Gemini could not be reached from the backend. Nothing was changed.",
    )


def _ensure_model(requested: str | None, models: list[str], fallback: str | None) -> str:
    if requested:
        name = requested.strip().removeprefix("models/")
        if not is_eligible_model(name):
            raise UnsupportedModelError(
                "Only Gemini Flash or Flash-Lite text models can be used.",
                details=(
                    "Pro, image, audio, TTS, video and embedding models are not eligible. "
                    "Choose a Flash or Flash-Lite text model from the list."
                ),
            )
        if name not in models:
            raise UnsupportedModelError(
                "That Gemini model is not available to this key.",
                details="Choose a model from the list returned by Google for this key.",
            )
        return name
    candidates = ranked_candidates(models, fallback, 1)
    if not candidates:
        raise UnsupportedModelError(
            "This key returned no eligible Gemini Flash or Flash-Lite text model.",
            details="Check the key's Google Cloud project.",
        )
    return candidates[0]


# ── public ────────────────────────────────────────────────────────────────


@router.get("/health")
def health() -> dict:
    settings = _settings()
    status_payload = availability_status(settings)
    return {
        "status": "ok",
        "service": "Fale7",
        "gemini_configured": status_payload.configured,
        "source": status_payload.source,
        "data_mode": status_payload.data_mode,
        "auth_mode": status_payload.auth_mode,
    }


@router.get("/availability", response_model=AvailabilityResponse)
def availability() -> AvailabilityResponse:
    return availability_status(_settings())


@router.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities(mode: str | None = Query(default=None, pattern="^(live|demo)$")):
    data_mode = resolve_mode(mode)
    entries = build_capabilities(data_mode=data_mode)
    return CapabilitiesResponse(
        data_mode=data_mode,
        capabilities=[CapabilityOut(**entry) for entry in entries],
        unavailable_ids=unavailable_ids(entries),
    )


@router.post("/ask", response_model=AskResponse)
async def ask(payload: AskRequest, request: Request) -> AskResponse:
    client_key = request.client.host if request.client else "local"
    return await ask_orchestrator(
        field_id=payload.field_id,
        message=payload.message,
        lang=payload.lang,
        conversation_id=payload.conversation_id,
        mode=payload.mode,
        client_key=client_key,
    )


# ── settings (protected) ──────────────────────────────────────────────────


@router.get(
    "/settings",
    response_model=SettingsStatus,
    dependencies=[Depends(require_settings_access)],
)
def settings_status(session: Session = Depends(get_session)) -> SettingsStatus:
    settings = _settings()
    rows = keystore.list_keys(session)
    active = next((row for row in rows if row["active"]), None)
    keys = [key_out(row) for row in rows]

    cached_models: list[str] = []
    models_source = "unavailable"
    cache_id = active["id"] if active is not None else ("environment" if settings.bootstrap_configured else None)
    if cache_id:
        cached_models = [
            model
            for model in (directory.get(cache_id) or [])
            if is_eligible_model(model)
        ]
        models_source = "cached" if cached_models else "unavailable"

    if active is not None:
        state = key_status(active)
        configured = state != "invalid"
        source = "saved"
        active_out = key_out(active)
        selected_model = active["model"] or settings.gemini_model.strip() or None
    elif settings.bootstrap_configured:
        configured = True
        source = "environment"
        selected_model = settings.gemini_model.strip() or None
        active_out = KeyOut(
            id="environment",
            label="Environment bootstrap key",
            masked_key=mask_secret(settings.gemini_api_key),
            status="valid",
            active=True,
            model=selected_model,
            created_at=_now(),
            last_validated_at=None,
            last_error_code=None,
            last_error_message=None,
            source="environment",
        )
    else:
        configured = False
        source = "none"
        selected_model = None
        active_out = None

    return SettingsStatus(
        configured=configured,
        source=source,
        active_key=active_out,
        keys=keys,
        models=cached_models,
        models_source=models_source,
        settings_token_required=settings.token_required,
        auth_mode=_auth_mode(settings),
        bootstrap_env_present=settings.bootstrap_configured,
    )


@router.post(
    "/settings/keys",
    response_model=KeyOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_settings_access), Depends(_guard_settings_rate)],
)
async def add_key(
    payload: KeyCreate,
    session: Session = Depends(get_session),
) -> KeyOut:
    settings = _settings()
    if keystore.count_keys(session) >= settings.max_keys:
        raise KeyLimitError(
            f"The maximum of {settings.max_keys} saved keys was reached.",
            details="Delete a key before adding another.",
        )

    problem = validate_key_format(payload.api_key)
    if problem:
        raise KeyRejectedError(problem, details="Nothing was saved.")

    outcome = await _client(payload.api_key, settings).validate()
    if not outcome.valid:
        google_said = (outcome.provider_message or "").strip()[:300]
        details = (
            f'Google said: "{google_said}" — the key was not saved. Nothing was sent to the browser.'
            if google_said
            else "The key was not saved. Nothing was sent to the browser."
        )
        error = KeyRejectedError(outcome.message, details=details)
        if outcome.code:
            error.code = outcome.code
        raise error

    models = eligible_models(outcome.models)
    requested = (payload.model or "").strip().removeprefix("models/") or None
    preferred = requested or settings.gemini_model.strip() or None
    if requested:
        _ensure_model(requested, models, None)
    model, probes = await find_working_model(
        _client(payload.api_key, settings),
        models,
        preferred=preferred,
        timeout=settings.gemini_probe_timeout_seconds,
        limit=1 if requested else PROBE_LIMIT,
        pin_preferred=bool(requested),
    )
    if not model:
        raise probe_failure(
            probes, action="Nothing was saved; the key was not stored."
        )

    already_active = keystore.active_key(session) is not None
    key_id = keystore.create_key(
        session,
        label=payload.label,
        ciphertext=_cipher(settings).encrypt(payload.api_key),
        masked_hint=mask_secret(payload.api_key),
        status="valid",
        model=model,
        active=not already_active,
        last_validated_at=_now(),
    )
    session.commit()
    directory.put(key_id, models)
    verified_models.put(key_id, payload.api_key, model)
    row = _get_row(session, key_id)
    return key_out(row)


@router.post(
    "/settings/keys/{key_id}/validate",
    response_model=ValidateResponse,
    dependencies=[Depends(require_settings_access), Depends(_guard_settings_rate)],
)
async def validate_key(
    key_id: str,
    session: Session = Depends(get_session),
) -> ValidateResponse:
    settings = _settings()
    row = _get_row(session, key_id)
    api_key = _decrypt(row, settings)
    outcome = await _client(api_key, settings).validate()

    if outcome.valid:
        models = eligible_models(outcome.models)
        verified_models.invalidate(key_id)
        preferred = row["model"] or settings.gemini_model.strip() or None
        model, probes = await find_working_model(
            _client(api_key, settings),
            models,
            preferred=preferred,
            timeout=settings.gemini_probe_timeout_seconds,
            limit=PROBE_LIMIT,
        )
        if not model:
            last = probes[-1] if probes else None
            code = last.code if last else "GEMINI_NO_MODELS"
            message = probe_summary(probes)
            if code == "GEMINI_KEY_INVALID":
                keystore.record_validation(
                    session,
                    key_id,
                    status="invalid",
                    model=None,
                    error_code=code,
                    error_message=message,
                )
                directory.invalidate(key_id)
                status_value = "invalid"
            else:
                # Quota, timeout and connectivity failures do not prove the key
                # is invalid, so the saved key and model are preserved.
                keystore.record_use(
                    session,
                    key_id,
                    error_code=code,
                    error_message=message,
                )
                status_value = (
                    "quota_limited" if code == "GEMINI_QUOTA_EXCEEDED" else "error"
                )
            session.commit()
            return ValidateResponse(
                key_id=key_id,
                valid=False,
                status=status_value,  # type: ignore[arg-type]
                code=code,
                message=message,
                models=models,
                model=row["model"],
                checked_at=_now(),
            )

        keystore.record_validation(
            session, key_id, status="valid", model=model, error_code=None, error_message=None
        )
        session.commit()
        directory.put(key_id, models)
        verified_models.put(key_id, api_key, model)
        message = f"{outcome.message} Verified {model} with a real generation test."
        if row["model"] and row["model"] != model:
            message = (
                f"{message} The saved model {row['model']} did not pass; "
                f"{model} was selected instead."
            )
        return ValidateResponse(
            key_id=key_id,
            valid=True,
            status="valid",
            code=None,
            message=message,
            models=models,
            model=model,
            checked_at=_now(),
        )

    if outcome.status == "invalid":
        keystore.record_validation(
            session,
            key_id,
            status="invalid",
            model=None,
            error_code=outcome.code,
            error_message=outcome.message,
        )
        directory.invalidate(key_id)
        verified_models.invalidate(key_id)
    else:
        # Quota and connectivity failures do not prove the key is invalid.
        keystore.record_use(
            session,
            key_id,
            error_code=outcome.code or "GEMINI_VALIDATION_FAILED",
            error_message=outcome.message,
        )
    session.commit()
    return ValidateResponse(
        key_id=key_id,
        valid=False,
        status=outcome.status,  # type: ignore[arg-type]
        code=outcome.code,
        message=outcome.message,
        models=eligible_models(outcome.models),
        model=row["model"],
        checked_at=_now(),
    )


@router.patch(
    "/settings/keys/{key_id}",
    response_model=KeyOut,
    dependencies=[Depends(require_settings_access), Depends(_guard_settings_rate)],
)
async def update_key(
    key_id: str,
    payload: KeyUpdate,
    session: Session = Depends(get_session),
) -> KeyOut:
    settings = _settings()
    row = _get_row(session, key_id)

    if payload.label is not None:
        keystore.set_label(session, key_id, payload.label)

    if "model" in payload.model_fields_set:
        if payload.model is None:
            keystore.set_model(session, key_id, None)
            verified_models.invalidate(key_id)
        else:
            api_key = _decrypt(row, settings)
            models = await _models_for(api_key, settings)
            requested = _ensure_model(payload.model, models, None)
            model, probes = await find_working_model(
                _client(api_key, settings),
                models,
                preferred=requested,
                timeout=settings.gemini_probe_timeout_seconds,
                limit=1,
                pin_preferred=True,
            )
            if not model:
                raise probe_failure(
                    probes, action="The previous model was preserved."
                )
            keystore.set_model(session, key_id, model)
            directory.put(key_id, models)
            verified_models.put(key_id, api_key, model)

    session.commit()
    return key_out(_get_row(session, key_id))


@router.post(
    "/settings/keys/{key_id}/activate",
    response_model=KeyOut,
    dependencies=[Depends(require_settings_access)],
)
async def activate_key(key_id: str, session: Session = Depends(get_session)) -> KeyOut:
    settings = _settings()
    row = _get_row(session, key_id)
    if row["status"] == "invalid":
        raise KeyNotActivatableError(
            "An invalid key cannot be activated.",
            details="Validate the key again, or choose another saved key.",
        )

    api_key = _decrypt(row, settings)
    models = eligible_models(directory.get(key_id) or [])
    if not models:
        models = await _models_for(api_key, settings)

    # Activation is an explicit key change, so the selected model must pass a
    # fresh real generation test before this key becomes active.
    verified_models.invalidate(key_id)
    preferred = row["model"] or settings.gemini_model.strip() or None
    model, probes = await find_working_model(
        _client(api_key, settings),
        models,
        preferred=preferred,
        timeout=settings.gemini_probe_timeout_seconds,
        limit=PROBE_LIMIT,
    )
    if not model:
        last = probes[-1] if probes else None
        code = last.code if last else "GEMINI_NO_MODELS"
        message = probe_summary(probes)
        if code == "GEMINI_KEY_INVALID":
            keystore.record_validation(
                session,
                key_id,
                status="invalid",
                model=None,
                error_code=code,
                error_message=message,
            )
            directory.invalidate(key_id)
        else:
            keystore.record_use(
                session, key_id, error_code=code, error_message=message
            )
        session.commit()
        raise probe_failure(probes, action="The active key was not changed.")

    keystore.record_validation(
        session, key_id, status="valid", model=model, error_code=None, error_message=None
    )
    keystore.activate_key(session, key_id)
    session.commit()
    directory.put(key_id, models)
    # Active credential changed: no previous verification may be reused.
    verified_models.invalidate_all()
    verified_models.put(key_id, api_key, model)
    return key_out(_get_row(session, key_id))


@router.delete(
    "/settings/keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_settings_access)],
)
def delete_key(key_id: str, session: Session = Depends(get_session)) -> Response:
    row = _get_row(session, key_id)
    was_active = bool(row["active"])
    if not keystore.delete_key(session, key_id):
        raise NotFoundError("Saved key not found.", details="It may already have been deleted.")
    session.commit()
    directory.invalidate(key_id)
    if was_active:
        verified_models.invalidate_all()
    else:
        verified_models.invalidate(key_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/settings/models",
    response_model=ModelListResponse,
    dependencies=[Depends(require_settings_access), Depends(_guard_settings_rate)],
)
async def list_models(
    key_id: str | None = Query(default=None),
    refresh: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> ModelListResponse:
    settings = _settings()
    if key_id:
        row = _get_row(session, key_id)
        api_key = _decrypt(row, settings)
        label = row["label"]
        source = "saved"
        preferred = row["model"] or settings.gemini_model.strip() or None
        cache_id = row["id"]
    else:
        row = keystore.active_key(session)
        if row is not None:
            api_key = _decrypt(row, settings)
            label = row["label"]
            source = "saved"
            preferred = row["model"] or settings.gemini_model.strip() or None
            cache_id = row["id"]
        elif settings.bootstrap_configured:
            api_key = settings.gemini_api_key.strip()
            label = "Environment bootstrap key"
            source = "environment"
            preferred = settings.gemini_model.strip() or None
            cache_id = "environment"
        else:
            raise NoActiveKeyError(
                "No Gemini key is available to list models.",
                details="Add and validate a key in Fale7 API settings.",
            )

    cached = None if refresh else directory.get(cache_id)
    if cached:
        cached = [model for model in cached if is_eligible_model(model)]
    if cached:
        models = cached
        cached_flag = True
        models_source = "cached"
    else:
        models = await _models_for(api_key, settings)
        directory.put(cache_id, models)
        cached_flag = False
        models_source = "live"

    default = ranked_candidates(models, preferred, 1)
    return ModelListResponse(
        key_id=cache_id,
        key_label=label,
        source=source,  # type: ignore[arg-type]
        models=models,
        default_model=default[0] if default else None,
        cached=cached_flag,
        models_source=models_source,  # type: ignore[arg-type]
    )
