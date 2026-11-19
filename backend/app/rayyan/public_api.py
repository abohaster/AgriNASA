"""
Fale7 API: external-app keys, one-time QR links and the public ask endpoint.

Why this module exists
----------------------
The Fale7 page generates a key that lets another app call Fale7 without the
browser. Security rules enforced here:

* The full key is returned only from the response that issues it and from a
  single-use, 10-minute QR access link. The dashboard only ever sees a prefix.
* Lookup uses a SHA-256 hash; the key itself is stored Fernet-encrypted so the
  QR flow can deliver it once. No plaintext is kept in the database.
* Revoking or re-generating replaces the stored hash, so the old key stops
  authenticating immediately.
* Every key is scoped to one read-only operation (ask on a field of this
  workspace) and is rate-limited per hour.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.ai.rate_limit import SlidingWindowLimiter
from app.db.database import get_session
from app.db.models import PublicApiAccessToken, PublicApiKey
from app.db import repository
from app.exceptions import AppError, NotFoundError, ValidationFailure
from app.rayyan.config import RayyanSettings, get_rayyan_settings
from app.rayyan.crypto import CipherError, KeyCipher
from app.rayyan.api import require_settings_access
from app.rayyan.errors import (
    AccessLinkGone,
    ApiKeyMissing,
    ApiKeyRevoked,
    KeyStoreError,
    PublicApiAuthError,
    PublicApiRateLimited,
    PublicApiRevokedError,
)
from app.rayyan.orchestrator import ask as ask_orchestrator
from app.rayyan.public_schemas import (
    AccessLinkOut,
    ApiAccessOut,
    ApiKeyState,
    ApiUsageOut,
    ConfidenceOut,
    PublicAskRequest,
    PublicAskResponse,
    RecommendationOut,
)
from app.rayyan.schemas import AskResponse, ValidationReportOut

router = APIRouter(prefix="/rayyan", tags=["fale7-api"])

KEY_ALPHABET = "fl7_"
SCOPES = ["fale7:ask"]
WINDOW = timedelta(hours=1)
ADMIN_LIMIT_PER_HOUR = 30

admin_limiter = SlidingWindowLimiter()


def _now() -> datetime:
    """Naive UTC, matching what SQLite stores for DateTime(timezone=True)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _cipher(settings: RayyanSettings) -> KeyCipher:
    try:
        return KeyCipher.from_settings(settings)
    except CipherError as exc:
        raise KeyStoreError(str(exc)) from exc


def _new_key(settings: RayyanSettings) -> tuple[str, str, str]:
    token = KEY_ALPHABET + secrets.token_urlsafe(32)
    cipher = _cipher(settings)
    try:
        ciphertext = cipher.encrypt(token)
    except Exception as exc:
        raise KeyStoreError(
            "The server could not encrypt the API key.",
            details="The key was not issued. Check the server encryption configuration.",
        ) from exc
    return token, token[:12], ciphertext


def _credential(session: Session, user_id: int) -> PublicApiKey | None:
    return session.scalar(select(PublicApiKey).where(PublicApiKey.user_id == user_id))


def _window(row: PublicApiKey, now: datetime) -> tuple[int, datetime]:
    """Effective (count, reset) without writing; expired windows read as empty."""
    started = _as_utc(row.window_started_at) if row.window_started_at else None
    if started is None or now.replace(tzinfo=timezone.utc) - started >= WINDOW:
        return 0, now + WINDOW
    return row.window_count, started.replace(tzinfo=None) + WINDOW


def _reset_window(row: PublicApiKey, now: datetime) -> None:
    started = _as_utc(row.window_started_at) if row.window_started_at else None
    if started is None or now.replace(tzinfo=timezone.utc) - started >= WINDOW:
        row.window_started_at = now
        row.window_count = 0


def _state(row: PublicApiKey, settings: RayyanSettings, *, key: str | None = None) -> ApiKeyState:
    now = _now()
    count, resets = _window(row, now)
    return ApiKeyState(
        exists=True,
        status="active" if row.active else "revoked",
        key=key,
        key_prefix=row.key_prefix,
        created_at=row.created_at,
        revoked_at=row.revoked_at,
        last_used_at=row.last_used_at,
        request_count=row.request_count,
        requests_this_hour=count,
        rate_limit_per_hour=settings.public_api_requests_per_hour,
        window_resets_at=resets,
        last_status=row.last_status,
        last_error_code=row.last_error_code,
        scopes=SCOPES,
    )


def _empty_state(settings: RayyanSettings) -> ApiKeyState:
    return ApiKeyState(
        exists=False,
        rate_limit_per_hour=settings.public_api_requests_per_hour,
        scopes=SCOPES,
    )


def _guard_admin(request: Request) -> None:
    host = request.client.host if request.client else "local"
    if not admin_limiter.allow(f"fale7-api-admin:{host}", ADMIN_LIMIT_PER_HOUR):
        raise PublicApiRateLimited(
            "Too many key-management requests from this client.",
            details="Wait an hour before trying again.",
        )


# ── Dashboard management ───────────────────────────────────────────────────


@router.get("/api", response_model=ApiKeyState)
def api_key_state(
    _auth: None = Depends(require_settings_access),
    session: Session = Depends(get_session),
) -> ApiKeyState:
    settings = get_rayyan_settings()
    user = repository.get_default_user(session)
    row = _credential(session, user.id)
    if row is None:
        return _empty_state(settings)
    return _state(row, settings)


@router.post("/api/generate", response_model=ApiKeyState)
def generate_api_key(
    request: Request,
    _auth: None = Depends(require_settings_access),
    session: Session = Depends(get_session),
) -> ApiKeyState:
    _guard_admin(request)
    settings = get_rayyan_settings()
    now = _now()
    user = repository.get_default_user(session)
    row = _credential(session, user.id)

    token, prefix, ciphertext = _new_key(settings)
    if row is None:
        row = PublicApiKey(
            user_id=user.id,
            key_prefix=prefix,
            key_hash=_sha256(token),
            key_ciphertext=ciphertext,
            active=True,
            created_at=now,
            window_started_at=now,
            window_count=0,
        )
        session.add(row)
    else:
        row.key_prefix = prefix
        row.key_hash = _sha256(token)
        row.key_ciphertext = ciphertext
        row.active = True
        row.created_at = now
        row.revoked_at = None
        row.last_used_at = None
        row.request_count = 0
        row.window_started_at = now
        row.window_count = 0
        row.last_status = None
        row.last_error_code = None
        # A re-issued key invalidates every QR link made for the old one.
        session.execute(
            delete(PublicApiAccessToken).where(PublicApiAccessToken.api_key_id == row.id)
        )
    session.commit()
    session.refresh(row)
    return _state(row, settings, key=token)


@router.post("/api/revoke", response_model=ApiKeyState)
def revoke_api_key(
    request: Request,
    _auth: None = Depends(require_settings_access),
    session: Session = Depends(get_session),
) -> ApiKeyState:
    _guard_admin(request)
    settings = get_rayyan_settings()
    user = repository.get_default_user(session)
    row = _credential(session, user.id)
    if row is None:
        raise ApiKeyMissing(
            "No Fale7 API key has been created yet.",
            details="Generate a key first.",
        )
    if row.active:
        row.active = False
        row.revoked_at = _now()
        session.execute(
            delete(PublicApiAccessToken).where(PublicApiAccessToken.api_key_id == row.id)
        )
        session.commit()
    return _state(row, settings)


@router.post("/api/access-link", response_model=AccessLinkOut)
def create_access_link(
    request: Request,
    _auth: None = Depends(require_settings_access),
    session: Session = Depends(get_session),
) -> AccessLinkOut:
    _guard_admin(request)
    settings = get_rayyan_settings()
    user = repository.get_default_user(session)
    row = _credential(session, user.id)
    if row is None:
        raise ApiKeyMissing(
            "No Fale7 API key has been created yet.",
            details="Generate a key before showing its QR code.",
        )
    if not row.active:
        raise ApiKeyRevoked(
            "This Fale7 API key was revoked.",
            details="Generate a new key to create a QR code.",
        )

    now = _now()
    token = secrets.token_urlsafe(32)
    expires = now + timedelta(minutes=settings.public_api_access_minutes)
    session.execute(
        delete(PublicApiAccessToken).where(
            PublicApiAccessToken.api_key_id == row.id,
            (PublicApiAccessToken.expires_at < now)
            | (PublicApiAccessToken.used_at.is_not(None)),
        )
    )
    session.add(
        PublicApiAccessToken(
            api_key_id=row.id, token_hash=_sha256(token), expires_at=expires
        )
    )
    session.commit()
    return AccessLinkOut(token=token, expires_at=expires)


@router.get("/api/access/{token}", response_model=ApiAccessOut)
def reveal_api_key(
    token: str,
    request: Request,
    session: Session = Depends(get_session),
) -> ApiAccessOut:
    _guard_admin(request)
    settings = get_rayyan_settings()
    now = _now()
    token_hash = _sha256(token.strip())

    link = session.scalar(
        select(PublicApiAccessToken).where(PublicApiAccessToken.token_hash == token_hash)
    )
    if link is None or link.used_at is not None or _as_utc(link.expires_at) <= now.replace(tzinfo=timezone.utc):
        raise AccessLinkGone(
            "This access link has expired or was already used.",
            details="Create a new QR code on the Fale7 API page.",
        )

    row = session.get(PublicApiKey, link.api_key_id)
    if row is None or not row.active:
        raise ApiKeyRevoked(
            "This Fale7 API key was revoked.",
            details="Generate a new key on the Fale7 API page.",
        )

    # Single use: the conditional UPDATE wins even if two scans arrive together.
    claimed = session.execute(
        update(PublicApiAccessToken)
        .where(
            PublicApiAccessToken.id == link.id,
            PublicApiAccessToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    if claimed.rowcount != 1:
        session.rollback()
        raise AccessLinkGone(
            "This access link has already been used.",
            details="Create a new QR code on the Fale7 API page.",
        )

    try:
        plaintext = _cipher(settings).decrypt(row.key_ciphertext)
    except Exception as exc:
        session.rollback()
        raise KeyStoreError(
            "The stored API key could not be decrypted.",
            details="Generate a new key on the Fale7 API page.",
        ) from exc

    session.commit()
    count, _resets = _window(row, now)
    return ApiAccessOut(
        key=plaintext,
        key_prefix=row.key_prefix,
        status="active",
        created_at=row.created_at,
        scopes=SCOPES,
        rate_limit_per_hour=settings.public_api_requests_per_hour,
        request_count=row.request_count,
        requests_this_hour=count,
    )


# ── External endpoint ──────────────────────────────────────────────────────


def _credential_from_header(
    session: Session, authorization: str | None
) -> PublicApiKey:
    if not authorization:
        raise PublicApiAuthError(
            "A Fale7 API key is required.",
            details="Send 'Authorization: Bearer <your Fale7 API key>'.",
        )
    scheme, _, token = authorization.partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token.startswith(KEY_ALPHABET):
        raise PublicApiAuthError(
            "The authorization header is malformed.",
            details="Expected 'Authorization: Bearer fl7_…' with a key issued on the Fale7 API page.",
        )
    row = session.scalar(select(PublicApiKey).where(PublicApiKey.key_hash == _sha256(token)))
    if row is None:
        raise PublicApiAuthError(
            "This Fale7 API key is not recognised.",
            details="Copy the key again or generate a new one on the Fale7 API page.",
        )
    if not row.active:
        raise PublicApiRevokedError(
            "This Fale7 API key was revoked.",
            details="Generate a new key on the Fale7 API page.",
        )
    return row


def _resolve_field(
    session: Session, payload: PublicAskRequest
):
    if payload.field_id is None:
        fields = repository.list_fields(session)
        if len(fields) != 1:
            raise ValidationFailure(
                "field_id is required.",
                details=(
                    "This workspace has more than one field, so the request must say "
                    "which field the question is about."
                ),
            )
        field = fields[0]
    else:
        field = repository.get_field(session, payload.field_id)
        if field is None:
            raise NotFoundError(
                "Field not found in this workspace.",
                details="Use a field id returned by the AgriNASA web app.",
            )

    if payload.crop:
        requested = payload.crop.strip().casefold()
        if requested not in {field.crop_id.casefold(), field.crop_name.casefold()}:
            raise ValidationFailure(
                "The requested crop does not match the selected field.",
                details=(
                    f"Field {field.id} grows {field.crop_name}. Use a field with that "
                    "crop, or omit the crop field."
                ),
            )
    return field


def _warnings(response: AskResponse, *, requested_language: str) -> list[str]:
    warnings: list[str] = []
    if response.is_demo:
        warnings.append(
            "Demo mode: the analyses describe the cached demo snapshot, not necessarily "
            "this field or today's weather."
        )
    if response.provider == "deterministic_fallback":
        warnings.append(
            "No AI model produced this answer. The text is a deterministic summary "
            "computed from the same verified context."
        )
    if response.validation.status == "rejected":
        warnings.append(
            "The AI reply contained figures or claims that are not in the computed data, "
            "so it was withheld and replaced by the deterministic summary."
        )
    if response.is_demo and requested_language == "ar":
        warnings.append("الإجابات في وضع العرض تصف لقطة تجريبية مخزّنة، وليست بالضرورة هذا الحقل.")
    return warnings


def _public_response(
    response: AskResponse,
    *,
    language: str,
    total_requests: int,
    window_count: int,
    settings: RayyanSettings,
) -> PublicAskResponse:
    context = response.context_used
    irrigation = context.get("irrigation") or {}
    health = context.get("crop_health") or {}
    confidence = irrigation.get("confidence") or {}
    limitations = list(context.get("limitations") or [])
    provenance = (context.get("provenance") or {}).get("statement")
    if provenance and provenance not in limitations:
        limitations.append(provenance)

    now = _now()
    return PublicAskResponse(
        answer=response.reply,
        recommendation=RecommendationOut(
            irrigation_demand=irrigation.get("demand"),
            irrigation_label=irrigation.get("demand_label"),
            demand_reasons=list(irrigation.get("demand_reasons") or []),
            crop_health_status=health.get("status"),
            crop_health_reason=health.get("status_reason"),
            robot_soil_moisture=irrigation.get("robot_soil_moisture"),
            moisture_assessment=irrigation.get("moisture_assessment"),
            irrigation_needed=irrigation.get("irrigation_needed"),
            water_requirement=irrigation.get("water_requirement"),
            plant_image=context.get("plant_images"),
        ),
        environmental_data=context.get("environment") or {},
        data_sources=response.sources,
        warnings=_warnings(response, requested_language=language),
        limitations=limitations,
        confidence=ConfidenceOut(
            level=confidence.get("level"),
            reasons=list(confidence.get("reasons") or []),
        ),
        provider=response.provider,
        model=response.model,
        data_mode="demo" if response.is_demo else "live",
        validation=ValidationReportOut(
            status=response.validation.status,
            checks=response.validation.checks,
            rejected_numbers=response.validation.rejected_numbers,
            removed_urls=response.validation.removed_urls,
            word_count=response.validation.word_count,
        ),
        conversation_id=response.conversation_id,
        usage=ApiUsageOut(
            total_requests=total_requests,
            requests_this_hour=window_count,
            rate_limit_per_hour=settings.public_api_requests_per_hour,
            window_resets_at=now + WINDOW,
        ),
    )


@router.post("/v1/ask", response_model=PublicAskResponse)
async def public_ask(
    payload: PublicAskRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> PublicAskResponse:
    settings = get_rayyan_settings()
    row = _credential_from_header(session, authorization)
    now = _now()

    _reset_window(row, now)
    if row.window_count >= settings.public_api_requests_per_hour:
        row.last_status = "rate_limited"
        row.last_used_at = now
        session.commit()
        _count, resets = _window(row, now)
        raise PublicApiRateLimited(
            "The hourly request limit for this API key was reached.",
            details=(
                f"Limit: {settings.public_api_requests_per_hour} requests per hour. "
                f"The window resets at {_as_utc(resets).isoformat(timespec='minutes')}."
            ),
        )

    row.window_count += 1
    row.request_count += 1
    row.last_used_at = now
    session.commit()

    try:
        field = _resolve_field(session, payload)
        response = await ask_orchestrator(
            field_id=field.id,
            message=payload.question,
            lang=payload.language,
            conversation_id=payload.conversation_id,
            mode=None,
            client_key=f"fale7-api:{row.id}",
            enforce_rate_limit=False,
        )
    except AppError as exc:
        row.last_status = "error"
        row.last_error_code = exc.code
        session.commit()
        raise
    except Exception:
        row.last_status = "error"
        row.last_error_code = "INTERNAL_ERROR"
        session.commit()
        raise

    row.last_status = "ok"
    row.last_error_code = None
    session.commit()

    return _public_response(
        response,
        language=payload.language,
        total_requests=row.request_count,
        window_count=row.window_count,
        settings=settings,
    )
