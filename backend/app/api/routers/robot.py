"""
Robot camera images, healthy references and soil-moisture history.

The dashboard uploads a photo already captured by the robot (or a device posts
it directly with its bearer key). The backend stores the file, runs the AI
review when a Gemini key is configured, and exposes the analysis with clear
confidence and limitations. No review is fabricated when AI is unavailable.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Header, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.rate_limit import limiter
from app.crops import list_calendars
from app.db.database import get_session
from app.db.models import Field, HealthyPlantReference, RobotImage, utcnow
from app.exceptions import NotFoundError, RateLimited, ValidationFailure
from app.schemas.robot_images import (
    AnalysisOut,
    FieldImagesOut,
    FieldMoistureOut,
    ImageUploadIn,
    MoisturePointOut,
    ReferenceOut,
    ReferenceUploadIn,
    RobotImageOut,
)
from app.services import plant_images, robot
from app.services.plant_images import analysis_payload, media_path
from app.api.routers.devices import _device_from_header

router = APIRouter(prefix="/robot", tags=["robot"])
ANALYSIS_LIMIT_PER_HOUR = 20


def _field_or_404(session: Session, field_id: int) -> Field:
    field = session.get(Field, field_id)
    if field is None:
        raise NotFoundError(
            "Field not found.",
            details="The field may have been deleted. Create or select another field.",
        )
    return field


def _file_url(kind: str, row_id: int) -> str:
    return f"/api/robot/{kind}/{row_id}/file"


def _image_out(image: RobotImage, analysis) -> RobotImageOut:
    return RobotImageOut(
        id=image.id,
        field_id=image.field_id,
        crop_id=image.crop_id,
        growth_stage=image.growth_stage,
        captured_at=image.captured_at,
        received_at=image.received_at,
        latitude=image.latitude,
        longitude=image.longitude,
        camera_id=image.camera_id,
        note=image.note,
        content_type=image.content_type,
        size_bytes=image.size_bytes,
        file_url=_file_url("images", image.id),
        analysis=AnalysisOut(**analysis_payload(analysis)) if analysis else None,
    )


def _reference_out(reference: HealthyPlantReference) -> ReferenceOut:
    return ReferenceOut(
        id=reference.id,
        crop_id=reference.crop_id,
        label=reference.label,
        content_type=reference.content_type,
        size_bytes=reference.size_bytes,
        source_note=reference.source_note,
        created_at=reference.created_at,
        file_url=_file_url("references", reference.id),
    )


def _serve(path: Path, media_type: str) -> FileResponse:
    if not path.is_file():
        raise NotFoundError(
            "The stored image file is missing.",
            details="The database row exists but its file is not on this server.",
        )
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


# ── Soil-moisture history ──────────────────────────────────────────────────


@router.get("/fields/{field_id}/moisture", response_model=FieldMoistureOut)
def field_moisture_history(
    field_id: int,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    session: Session = Depends(get_session),
) -> FieldMoistureOut:
    field = _field_or_404(session, field_id)
    now = datetime.now(timezone.utc)
    window_end = end or now
    window_start = start or (window_end - timedelta(days=7))
    if window_start > window_end:
        raise ValidationFailure("The start of the period is after its end.")

    points = robot.moisture_series(
        session, field.id, start=window_start, end=window_end, limit=limit
    )
    latest = robot.field_moisture(session, field.id)
    values = [float(row.soil_moisture_pct or 0.0) for row in points]
    sensors = {row.sensor_id or f"device-{row.device_id}" for row in points}
    return FieldMoistureOut(
        field_id=field.id,
        status=latest.status,
        latest_pct=latest.latest_pct,
        latest_measured_at=latest.latest_measured_at,
        latest_sensor_id=latest.latest_sensor_id,
        measurement_status=latest.measurement_status,
        reading_count=len(points),
        sensor_count=len(sensors),
        mean_pct=round(sum(values) / len(values), 2) if values else None,
        min_pct=round(min(values), 2) if values else None,
        max_pct=round(max(values), 2) if values else None,
        reason=latest.reason,
        points=[
            MoisturePointOut(
                id=row.id,
                soil_moisture_pct=float(row.soil_moisture_pct or 0.0),
                measured_at=row.measured_at,
                sensor_id=row.sensor_id,
                sensor_label=row.sensor_id or f"robot {row.device_id}",
                status=row.status,
                latitude=row.latitude,
                longitude=row.longitude,
            )
            for row in points
        ],
    )


# ── Plant photos ───────────────────────────────────────────────────────────


def _store_and_review(
    session: Session,
    *,
    field: Field,
    payload: ImageUploadIn,
    device_id: int | None,
    analyze: bool,
) -> RobotImageOut:
    image = plant_images.create_image(
        session,
        field=field,
        image_base64=payload.image_base64,
        content_type=payload.content_type,
        captured_at=payload.captured_at,
        growth_stage=payload.growth_stage,
        camera_id=payload.camera_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        note=payload.note,
        device_id=device_id,
    )
    session.commit()
    session.refresh(image)
    analysis = None
    if analyze:
        import asyncio

        analysis = asyncio.run(plant_images.analyze_image(session, image))
    return _image_out(image, analysis)


@router.post("/fields/{field_id}/images", response_model=RobotImageOut, status_code=201)
def upload_field_image(
    field_id: int,
    payload: ImageUploadIn,
    analyze: bool = Query(default=True),
    session: Session = Depends(get_session),
) -> RobotImageOut:
    field = _field_or_404(session, field_id)
    return _store_and_review(session, field=field, payload=payload, device_id=None, analyze=analyze)


@router.post("/ingest/images", response_model=RobotImageOut, status_code=201)
def upload_device_image(
    payload: ImageUploadIn,
    analyze: bool = Query(default=True),
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> RobotImageOut:
    device = _device_from_header(session, authorization)
    field = _field_or_404(session, device.field_id)
    return _store_and_review(
        session, field=field, payload=payload, device_id=device.id, analyze=analyze
    )


@router.get("/fields/{field_id}/images", response_model=FieldImagesOut)
def list_field_images(
    field_id: int,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=60, ge=1, le=200),
    session: Session = Depends(get_session),
) -> FieldImagesOut:
    field = _field_or_404(session, field_id)
    entries = plant_images.field_images(session, field, limit=limit, start=start, end=end)
    references = list(
        session.scalars(
            select(HealthyPlantReference)
            .where(HealthyPlantReference.crop_id == field.crop_id)
            .order_by(HealthyPlantReference.created_at.desc(), HealthyPlantReference.id.desc())
        )
    )
    return FieldImagesOut(
        field_id=field.id,
        crop_id=field.crop_id,
        images=[_image_out(image, analysis) for image, analysis in entries],
        references=[_reference_out(reference) for reference in references],
        healthy_reference_available=bool(references),
    )


@router.get("/images/{image_id}", response_model=RobotImageOut)
def image_detail(image_id: int, session: Session = Depends(get_session)) -> RobotImageOut:
    image = session.get(RobotImage, image_id)
    if image is None:
        raise NotFoundError("Image not found.")
    return _image_out(image, plant_images.latest_analysis(session, image.id))


@router.get("/images/{image_id}/file")
def image_file(image_id: int, session: Session = Depends(get_session)) -> FileResponse:
    image = session.get(RobotImage, image_id)
    if image is None:
        raise NotFoundError("Image not found.")
    return _serve(media_path("robot", image.filename), image.content_type)


@router.post("/images/{image_id}/analyze", response_model=AnalysisOut)
def analyze_image(
    image_id: int,
    force: bool = Query(default=True),
    session: Session = Depends(get_session),
) -> AnalysisOut:
    image = session.get(RobotImage, image_id)
    if image is None:
        raise NotFoundError("Image not found.")
    if not limiter.allow(f"robot-image-analysis:{image.field_id}", ANALYSIS_LIMIT_PER_HOUR):
        raise RateLimited(
            "Too many image reviews for this field in the last hour.",
            details=f"Limit: {ANALYSIS_LIMIT_PER_HOUR} per hour. Try again later.",
        )
    import asyncio

    analysis = asyncio.run(plant_images.analyze_image(session, image, force=force))
    return AnalysisOut(**analysis_payload(analysis))  # type: ignore[arg-type]


# ── Healthy references ─────────────────────────────────────────────────────


@router.get("/references", response_model=list[ReferenceOut])
def list_references(
    crop_id: str | None = Query(default=None, max_length=40),
    session: Session = Depends(get_session),
) -> list[ReferenceOut]:
    query = select(HealthyPlantReference).order_by(
        HealthyPlantReference.created_at.desc(), HealthyPlantReference.id.desc()
    )
    if crop_id:
        query = query.where(HealthyPlantReference.crop_id == crop_id)
    return [_reference_out(reference) for reference in session.scalars(query)]


@router.post("/references", response_model=ReferenceOut, status_code=201)
def upload_reference(
    payload: ReferenceUploadIn, session: Session = Depends(get_session)
) -> ReferenceOut:
    reference = plant_images.create_reference(
        session,
        crop_id=payload.crop_id,
        label=payload.label,
        image_base64=payload.image_base64,
        content_type=payload.content_type,
        source_note=payload.source_note,
    )
    session.commit()
    session.refresh(reference)
    return _reference_out(reference)


@router.get("/references/{reference_id}/file")
def reference_file(reference_id: int, session: Session = Depends(get_session)) -> FileResponse:
    reference = session.get(HealthyPlantReference, reference_id)
    if reference is None:
        raise NotFoundError("Reference image not found.")
    return _serve(media_path("references", reference.filename), reference.content_type)


@router.delete("/references/{reference_id}", status_code=204, response_class=Response)
def delete_reference(reference_id: int, session: Session = Depends(get_session)) -> Response:
    reference = session.get(HealthyPlantReference, reference_id)
    if reference is None:
        raise NotFoundError("Reference image not found.")
    session.delete(reference)
    session.commit()
    return Response(status_code=204)


@router.get("/plant-stages")
def plant_stages() -> dict[str, list[dict[str, str]]]:
    """Fixed stage vocabulary used by image metadata and the UI selectors."""
    from app.schemas.robot_images import GROWTH_STAGES

    labels = {
        "germination": "Germination",
        "seedling": "Seedling",
        "vegetative_growth": "Vegetative growth",
        "flowering": "Flowering",
        "fruiting": "Fruiting",
        "maturity": "Maturity",
        "harvest": "Harvest",
    }
    return {
        "stages": [{"id": stage, "label": labels[stage]} for stage in GROWTH_STAGES],
        "crops": [{"id": calendar.id, "name": calendar.name} for calendar in list_calendars()],
    }
