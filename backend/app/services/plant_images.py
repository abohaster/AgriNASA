"""
Robot plant photos, healthy references and the server-side AI image review.

FLOW
----
Robot camera → upload (device key or dashboard) → file stored on the server →
optional AI vision review → cautious label + confidence + comparison with a
healthy reference and the previous photo → stored analysis → shown in the UI
and supplied (text only) to Fale7.

The review is advisory. It never names a disease as a fact, never returns
"100%", and every result states its limitations. When no Gemini key is
configured the analysis is stored as `unavailable`; no label is invented.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.crops import get_crop
from app.db.models import Field, HealthyPlantReference, PlantImageAnalysis, RobotImage
from app.exceptions import NotFoundError, ValidationFailure
from app.rayyan.config import get_rayyan_settings
from app.rayyan.errors import RayyanError
from app.rayyan.gemini import GeminiCallError, GeminiClient
from app.rayyan.model_health import eligible_models, ranked_candidates
from app.schemas.robot_images import REVIEW_LABELS

logger = logging.getLogger(__name__)

SIGNATURES = (
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
)

REVIEW_SYSTEM = (
    "You are an agricultural image reviewer inside AgriNASA. You describe visible "
    "plant symptoms from a single field photograph. You never diagnose a disease, "
    "never guarantee a cause and never use absolute language. You may only return "
    "one of the allowed labels. If the image is unclear, use 'uncertain'. Return "
    "strict JSON only, with no markdown."
)

REVIEW_PROMPT = """Review the plant photograph(s) for {crop} at the {stage} stage.

Image 1: current photo from the field robot camera.
{extra_images}
Field context (do not treat it as a diagnosis): {context}

Return exactly this JSON shape:
{{
  "label": "healthy_appearance | possible_stress | possible_nutrient_issue | possible_disease_symptoms | possible_environmental_stress | uncertain",
  "confidence": 0.0-1.0,
  "summary": "one or two cautious sentences for a farmer",
  "observations": ["visible observation", "..."],
  "visual_differences": ["difference versus the reference or previous photo", "..."],
  "limitations": ["what this photo cannot show", "..."]
}}

Rules:
- Use moderate wording ("possible", "may be related to", "consistent with").
- If a healthy reference image is supplied, describe visible differences only.
- Never state a certainty of 100%; cap confidence at 0.95.
- Keep the summary under 70 words."""


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _naive_utc(value: datetime) -> datetime:
    return value if value.tzinfo is None else value.astimezone(timezone.utc).replace(tzinfo=None)


def _media_dir(kind: str) -> Path:
    path = get_settings().robot_media_path / kind
    path.mkdir(parents=True, exist_ok=True)
    return path


def decode_image(image_base64: str, content_type: str) -> tuple[bytes, str, str]:
    """Decode, size-check and sniff the real image format."""
    raw_text = image_base64.strip()
    if raw_text.startswith("data:") and "," in raw_text:
        raw_text = raw_text.split(",", 1)[1]
    try:
        data = base64.b64decode(raw_text, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValidationFailure(
            "The image data could not be decoded.",
            details="Send base64-encoded JPEG, PNG or WebP bytes without a data: prefix.",
        ) from exc
    limit = get_settings().robot_image_max_bytes
    if len(data) < 64:
        raise ValidationFailure("The uploaded image is empty.")
    if len(data) > limit:
        raise ValidationFailure(
            f"The image is larger than {limit // (1024 * 1024)} MB.",
            details="Resize or re-encode the photo before uploading.",
        )

    detected = None
    for signature, mime, extension in SIGNATURES:
        if data.startswith(signature):
            detected = (mime, extension)
            break
    if detected is None and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        detected = ("image/webp", "webp")
    if detected is None:
        raise ValidationFailure(
            "The uploaded file is not a JPEG, PNG or WebP image.",
        )
    mime, extension = detected
    if mime != content_type:
        # Trust the bytes, not the declared header, and say so in the response.
        logger.info("Image content type %s overridden by sniffed %s", content_type, mime)
    return data, mime, extension


def _write(data: bytes, kind: str, extension: str) -> tuple[str, str]:
    name = f"{uuid.uuid4().hex}.{extension}"
    path = _media_dir(kind) / name
    path.write_bytes(data)
    return name, hashlib.sha256(data).hexdigest()


def media_path(kind: str, filename: str) -> Path:
    # `filename` is generated by this module; still resolve and confine it.
    base = _media_dir(kind).resolve()
    candidate = (base / Path(filename).name).resolve()
    if base not in candidate.parents:
        raise NotFoundError("Image file not found.")
    return candidate


def create_image(
    session: Session,
    *,
    field: Field,
    image_base64: str,
    content_type: str,
    captured_at: datetime | None,
    growth_stage: str | None,
    camera_id: str | None,
    latitude: float | None,
    longitude: float | None,
    note: str | None,
    device_id: int | None = None,
) -> RobotImage:
    data, mime, extension = decode_image(image_base64, content_type)
    now = datetime.now(timezone.utc)
    captured = _as_utc(captured_at) or now
    # Tolerate small clock drift, reject clearly impossible capture times.
    if (captured - now).total_seconds() > 600:
        raise ValidationFailure(
            "The capture timestamp is in the future.",
            details="Check the camera clock or omit captured_at to use server time.",
        )
    filename, digest = _write(data, "robot", extension)
    image = RobotImage(
        field_id=field.id,
        device_id=device_id,
        crop_id=field.crop_id,
        growth_stage=growth_stage,
        filename=filename,
        content_type=mime,
        size_bytes=len(data),
        sha256=digest,
        camera_id=camera_id,
        latitude=latitude if latitude is not None else field.latitude,
        longitude=longitude if longitude is not None else field.longitude,
        note=note,
        captured_at=captured,
        received_at=now,
    )
    session.add(image)
    session.flush()
    return image


def create_reference(
    session: Session,
    *,
    crop_id: str,
    label: str,
    image_base64: str,
    content_type: str,
    source_note: str | None,
) -> HealthyPlantReference:
    crop = get_crop(crop_id)
    if crop is None:
        raise ValidationFailure(
            f"Crop '{crop_id}' is not registered.",
            details="Use a crop id from the crop reference list.",
        )
    data, mime, extension = decode_image(image_base64, content_type)
    filename, digest = _write(data, "references", extension)
    reference = HealthyPlantReference(
        crop_id=crop.id,
        label=label.strip()[:120],
        filename=filename,
        content_type=mime,
        size_bytes=len(data),
        sha256=digest,
        source_note=(source_note or "").strip()[:255] or None,
    )
    session.add(reference)
    session.flush()
    return reference


def reference_for_crop(session: Session, crop_id: str) -> HealthyPlantReference | None:
    return session.scalar(
        select(HealthyPlantReference)
        .where(HealthyPlantReference.crop_id == crop_id)
        .order_by(HealthyPlantReference.created_at.desc(), HealthyPlantReference.id.desc())
    )


def latest_analysis(session: Session, image_id: int) -> PlantImageAnalysis | None:
    return session.scalar(
        select(PlantImageAnalysis)
        .where(PlantImageAnalysis.image_id == image_id)
        .order_by(PlantImageAnalysis.id.desc())
    )


def analyses_for(session: Session, image_ids: list[int]) -> dict[int, PlantImageAnalysis]:
    if not image_ids:
        return {}
    rows = list(
        session.scalars(
            select(PlantImageAnalysis)
            .where(PlantImageAnalysis.image_id.in_(image_ids))
            .order_by(PlantImageAnalysis.id)
        )
    )
    latest: dict[int, PlantImageAnalysis] = {}
    for row in rows:
        latest[row.image_id] = row
    return latest


def previous_analyzed_image(
    session: Session, image: RobotImage
) -> tuple[RobotImage, PlantImageAnalysis] | None:
    row = session.execute(
        select(RobotImage, PlantImageAnalysis)
        .join(PlantImageAnalysis, PlantImageAnalysis.image_id == RobotImage.id)
        .where(
            RobotImage.field_id == image.field_id,
            RobotImage.id != image.id,
            RobotImage.captured_at < image.captured_at,
            PlantImageAnalysis.status == "ok",
        )
        .order_by(RobotImage.captured_at.desc(), PlantImageAnalysis.id.desc())
        .limit(1)
    ).first()
    return (row[0], row[1]) if row else None


def _parse_review(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(cleaned[start : end + 1])
    except (TypeError, ValueError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _string_list(value: Any, limit: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    items = [str(item).strip() for item in value if isinstance(item, (str, int, float))]
    return [item[:240] for item in items if item][:limit]


def _confidence_pct(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number <= 1.0:
        number *= 100.0
    return round(max(0.0, min(95.0, number)), 1)


def _safe_summary(value: Any) -> str:
    text = str(value or "").strip()[:600]
    lowered = text.lower()
    for absolute in ("100%", "definitely", "diagnosed", "confirmed disease", "guaranteed"):
        if absolute in lowered:
            text = text.replace(absolute, "possible")
    return text


async def analyze_image(
    session: Session,
    image: RobotImage,
    *,
    force: bool = False,
) -> PlantImageAnalysis:
    """Run (or reuse) the AI vision review for one stored image."""
    existing = latest_analysis(session, image.id)
    if existing is not None and existing.status == "ok" and not force:
        return existing

    reference = reference_for_crop(session, image.crop_id)
    previous = previous_analyzed_image(session, image)
    comparison: dict[str, Any] = {
        "reference_image_id": reference.id if reference else None,
        "reference_label": reference.label if reference else None,
        "reference_available": reference is not None,
        "previous_image_id": previous[0].id if previous else None,
        "previous_captured_at": (
            _as_utc(previous[0].captured_at).isoformat() if previous and previous[0].captured_at else None
        ),
        "visual_differences": [],
        "note": (
            "Comparison uses AI vision on real photos, not pixel similarity."
            if reference is not None
            else "No healthy reference photo is on file for this crop; only the current photo was reviewed."
        ),
    }

    ry_settings = get_rayyan_settings()
    try:
        from app.rayyan.orchestrator import resolve_credential

        credential = resolve_credential(session, ry_settings)
    except RayyanError as exc:
        return _save_unavailable(
            session,
            image,
            reason=f"{exc.message} {exc.details or ''}".strip(),
            comparison=comparison,
        )
    except Exception as exc:  # noqa: BLE001 — key storage misconfiguration
        logger.warning("Image review could not resolve a key: %s", type(exc).__name__)
        return _save_unavailable(
            session,
            image,
            reason=(
                "The backend could not read the stored AI key, so no image review was "
                "produced. Check Fale7 → API settings."
            ),
            comparison=comparison,
        )

    client = GeminiClient(
        credential.api_key,
        base_url=ry_settings.gemini_base_url,
        timeout=max(ry_settings.gemini_timeout_seconds, 60.0),
        connect_timeout=ry_settings.gemini_connect_timeout_seconds,
    )
    model = credential.model
    if not model:
        try:
            candidates = eligible_models(await client.list_models())
        except GeminiCallError as exc:
            return _save_unavailable(
                session, image, reason=exc.message, comparison=comparison, provider="gemini"
            )
        ranked = ranked_candidates(candidates, None, 1)
        if not ranked:
            return _save_unavailable(
                session,
                image,
                reason="The active Gemini key returned no eligible vision model.",
                comparison=comparison,
                provider="gemini",
            )
        model = ranked[0]

    images: list[dict[str, str]] = [
        {
            "mime_type": image.content_type,
            "data_base64": base64.b64encode(
                media_path("robot", image.filename).read_bytes()
            ).decode("ascii"),
        }
    ]
    extra_lines: list[str] = []
    if reference is not None:
        images.append(
            {
                "mime_type": reference.content_type,
                "data_base64": base64.b64encode(
                    media_path("references", reference.filename).read_bytes()
                ).decode("ascii"),
            }
        )
        extra_lines.append(
            f"Image {len(images)}: healthy reference photo for this crop supplied by the operator."
        )
    if previous is not None:
        images.append(
            {
                "mime_type": previous[0].content_type,
                "data_base64": base64.b64encode(
                    media_path("robot", previous[0].filename).read_bytes()
                ).decode("ascii"),
            }
        )
        extra_lines.append(
            f"Image {len(images)}: previous photo from the same field, captured "
            f"{_as_utc(previous[0].captured_at).date().isoformat()}."
        )

    crop = get_crop(image.crop_id)
    context = (
        f"field area {image.latitude:.5f}, {image.longitude:.5f}; "
        f"captured {_as_utc(image.captured_at).isoformat(timespec='minutes')}; "
        f"camera note: {image.note or 'none'}"
    )
    prompt = REVIEW_PROMPT.format(
        crop=crop.name if crop else image.crop_id,
        stage=(image.growth_stage or "unrecorded").replace("_", " "),
        extra_images="\n".join(extra_lines) or "No reference or previous image is available.",
        context=context,
    )

    try:
        result = await client.generate_vision(
            model=model,
            system=REVIEW_SYSTEM,
            prompt=prompt,
            images=images,
            max_output_tokens=800,
        )
    except GeminiCallError as exc:
        return _save_unavailable(
            session, image, reason=exc.message, comparison=comparison, provider="gemini"
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Image review failed: %s", type(exc).__name__)
        return _save_unavailable(
            session,
            image,
            reason="The image review could not be completed. Nothing was invented.",
            comparison=comparison,
            provider="gemini",
        )

    parsed = _parse_review(result.text)
    if parsed is None:
        return _save_unavailable(
            session,
            image,
            reason="The AI reply could not be read as structured JSON, so it was not used.",
            comparison=comparison,
            provider="gemini",
            model=result.model,
        )

    label = str(parsed.get("label", "")).strip().lower()
    if label not in REVIEW_LABELS:
        label = "uncertain"
    comparison["visual_differences"] = _string_list(parsed.get("visual_differences"), 6)
    observations = _string_list(parsed.get("observations"), 8)
    limitations = _string_list(parsed.get("limitations"), 6)
    limitations.append(
        "A single photograph cannot confirm a cause. Inspect the plant in the field "
        "or consult an agronomist before treating it."
    )
    if reference is None:
        limitations.append(
            "No healthy reference photo is on file for this crop, so no reference "
            "comparison was made."
        )

    analysis = PlantImageAnalysis(
        image_id=image.id,
        status="ok",
        label=label,
        confidence=_confidence_pct(parsed.get("confidence")),
        summary=_safe_summary(parsed.get("summary")),
        observations_json=json.dumps(observations, ensure_ascii=False),
        comparison_json=json.dumps(comparison, ensure_ascii=False),
        limitations_json=json.dumps(list(dict.fromkeys(limitations)), ensure_ascii=False),
        provider="gemini",
        model=result.model,
        reference_image_id=reference.id if reference else None,
        previous_image_id=previous[0].id if previous else None,
    )
    session.add(analysis)
    session.commit()
    session.refresh(analysis)
    return analysis


def _save_unavailable(
    session: Session,
    image: RobotImage,
    *,
    reason: str,
    comparison: dict[str, Any],
    provider: str = "none",
    model: str | None = None,
) -> PlantImageAnalysis:
    comparison = {**comparison, "visual_differences": []}
    analysis = PlantImageAnalysis(
        image_id=image.id,
        status="unavailable",
        label=None,
        confidence=None,
        summary=reason[:600],
        observations_json="[]",
        comparison_json=json.dumps(comparison, ensure_ascii=False),
        limitations_json=json.dumps(
            [
                "No AI image review was produced, so no health label is shown.",
                "Upload a new image or configure an AI key to retry.",
            ]
        ),
        provider=provider,
        model=model,
        reference_image_id=comparison.get("reference_image_id"),
        previous_image_id=comparison.get("previous_image_id"),
    )
    session.add(analysis)
    session.commit()
    session.refresh(analysis)
    return analysis


def analysis_payload(analysis: PlantImageAnalysis | None) -> dict[str, Any] | None:
    if analysis is None:
        return None
    comparison = json.loads(analysis.comparison_json or "{}")
    observations = json.loads(analysis.observations_json or "[]")
    limitations = json.loads(analysis.limitations_json or "[]")
    return {
        "id": analysis.id,
        "status": analysis.status,
        "label": analysis.label,
        "label_text": REVIEW_LABELS.get(analysis.label or ""),
        "confidence_pct": analysis.confidence,
        "summary": analysis.summary,
        "observations": observations if isinstance(observations, list) else [],
        "comparison": comparison if isinstance(comparison, dict) else {},
        "limitations": limitations if isinstance(limitations, list) else [],
        "provider": analysis.provider,
        "model": analysis.model,
        "created_at": analysis.created_at,
    }


def field_images(
    session: Session,
    field: Field,
    *,
    limit: int = 60,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[tuple[RobotImage, PlantImageAnalysis | None]]:
    query = select(RobotImage).where(RobotImage.field_id == field.id)
    if start is not None:
        query = query.where(RobotImage.captured_at >= _naive_utc(start))
    if end is not None:
        query = query.where(RobotImage.captured_at <= _naive_utc(end))
    images = list(
        session.scalars(
            query.order_by(RobotImage.captured_at.desc(), RobotImage.id.desc()).limit(limit)
        )
    )
    latest = analyses_for(session, [image.id for image in images])
    return [(image, latest.get(image.id)) for image in images]


def context_block(session: Session, field: Field) -> dict[str, Any]:
    """Latest photo review summary for the Fale7 context (text only)."""
    images = field_images(session, field, limit=6)
    if not images:
        return {
            "available": False,
            "reason": "No robot plant photo has been uploaded for this field.",
        }
    latest_image, latest_review = images[0]
    reference = reference_for_crop(session, field.crop_id)
    comparison = json.loads(latest_review.comparison_json or "{}") if latest_review else {}
    return {
        "available": True,
        "latest_image": {
            "id": latest_image.id,
            "captured_at": _as_utc(latest_image.captured_at).isoformat(timespec="seconds"),
            "growth_stage": latest_image.growth_stage,
            "location": {
                "latitude": latest_image.latitude,
                "longitude": latest_image.longitude,
            },
            "source": "field robot camera",
        },
        "review_status": latest_review.status if latest_review else "not_run",
        "label": latest_review.label if latest_review else None,
        "label_text": (
            REVIEW_LABELS.get(latest_review.label or "") if latest_review else None
        ),
        "confidence_pct": latest_review.confidence if latest_review else None,
        "summary": latest_review.summary if latest_review else None,
        "observations": (
            json.loads(latest_review.observations_json or "[]") if latest_review else []
        ),
        "comparison": comparison,
        "healthy_reference_available": reference is not None,
        "history_count": len(images),
        "limitations": (
            json.loads(latest_review.limitations_json or "[]") if latest_review else []
        ),
        "note": (
            "AI image review is advisory. It is not a laboratory test or a confirmed diagnosis."
        ),
    }
