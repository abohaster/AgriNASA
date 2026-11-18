"""
Field endpoints: profile CRUD plus the four derived analyses.

ROUTER RESPONSIBILITY
---------------------
* Validate request-level concerns (dates, mode, ownership).
* Call one service per analysis.
* Commit the transaction once, after the service succeeded.

NASA calls and science live in `app/services` and `app/science`; nothing here
performs calculations.
"""

import json
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.crops import get_crop
from app.db import repository
from app.db.database import get_session
from app.db.models import Field
from app.exceptions import NotFoundError, ValidationFailure
from app.schemas.environment import EnvironmentResponse
from app.schemas.fields import FieldCreate, FieldOut, FieldUpdate
from app.schemas.health import CropHealthAnalysis, VegetationResponse
from app.schemas.irrigation import IrrigationAnalysis
from app.services import crop_health
from app.services import environment as environment_service
from app.services import irrigation as irrigation_service
from app.services import vegetation as vegetation_service

router = APIRouter(prefix="/fields", tags=["fields"])

ModeLiteral = Literal["live", "demo"]


def _resolve_mode(mode: ModeLiteral | None) -> str:
    """Use the request mode, otherwise the server-wide default from settings."""
    return mode or get_settings().data_mode


def _get_field_or_404(session: Session, field_id: int) -> Field:
    field = repository.get_field(session, field_id)
    if field is None:
        raise NotFoundError(
            "Field not found.",
            details="The field may have been deleted. Create a new field to continue.",
        )
    return field


def _encode_boundary(values: dict) -> dict:
    """Store validated GeoJSON as text; the ORM column is Text, not JSON."""
    boundary = values.get("boundary_geojson")
    if boundary is not None:
        values["boundary_geojson"] = json.dumps(boundary, separators=(",", ":"))
    return values


def _validate_range(start: date | None, end: date | None) -> None:
    if start is not None and start < date(1981, 1, 1):
        raise ValidationFailure("Start date is before NASA POWER's coverage (1981-01-01).")
    if start is not None and end is not None and start > end:
        raise ValidationFailure("Start date must be on or before the end date.")


@router.get("", response_model=list[FieldOut])
def list_fields(session: Session = Depends(get_session)) -> list[Field]:
    return repository.list_fields(session)


@router.post("", response_model=FieldOut, status_code=status.HTTP_201_CREATED)
def create_field(payload: FieldCreate, session: Session = Depends(get_session)) -> Field:
    if get_crop(payload.crop_id) is None:
        raise ValidationFailure(
            f"Crop '{payload.crop_id}' is not supported.",
            details="Only crops registered in backend/app/crops can be created.",
        )
    field = repository.create_field(session, values=_encode_boundary(payload.model_dump()))
    session.commit()
    session.refresh(field)
    return field


@router.get("/{field_id}", response_model=FieldOut)
def get_field(field_id: int, session: Session = Depends(get_session)) -> Field:
    return _get_field_or_404(session, field_id)


@router.patch("/{field_id}", response_model=FieldOut)
def update_field(
    field_id: int, payload: FieldUpdate, session: Session = Depends(get_session)
) -> Field:
    field = _get_field_or_404(session, field_id)
    changes = _encode_boundary(payload.model_dump(exclude_unset=True))
    for key, value in changes.items():
        setattr(field, key, value)
    session.commit()
    session.refresh(field)
    return field


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(field_id: int, session: Session = Depends(get_session)) -> Response:
    field = _get_field_or_404(session, field_id)
    repository.delete_field(session, field)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{field_id}/environment", response_model=EnvironmentResponse)
def field_environment(
    field_id: int,
    start: date | None = Query(default=None, description="Default: planting date"),
    end: date | None = Query(default=None, description="Default: yesterday"),
    mode: ModeLiteral | None = None,
    session: Session = Depends(get_session),
) -> EnvironmentResponse:
    field = _get_field_or_404(session, field_id)
    _validate_range(start, end)
    response, _processed, _series = environment_service.build_environment(
        session, field=field, start=start, end=end, mode=_resolve_mode(mode)
    )
    session.commit()
    return response


@router.get("/{field_id}/irrigation", response_model=IrrigationAnalysis)
def field_irrigation(
    field_id: int,
    end: date | None = None,
    mode: ModeLiteral | None = None,
    session: Session = Depends(get_session),
) -> IrrigationAnalysis:
    field = _get_field_or_404(session, field_id)
    analysis = irrigation_service.analyze_irrigation(
        session, field=field, end=end, mode=_resolve_mode(mode)
    )
    session.commit()
    return analysis


@router.get("/{field_id}/health", response_model=CropHealthAnalysis)
def field_health(
    field_id: int,
    end: date | None = None,
    mode: ModeLiteral | None = None,
    session: Session = Depends(get_session),
) -> CropHealthAnalysis:
    field = _get_field_or_404(session, field_id)
    analysis = crop_health.analyze_health(session, field=field, end=end, mode=_resolve_mode(mode))
    session.commit()
    return analysis


@router.get("/{field_id}/vegetation", response_model=VegetationResponse)
def field_vegetation(
    field_id: int,
    mode: ModeLiteral | None = None,
    session: Session = Depends(get_session),
) -> VegetationResponse:
    field = _get_field_or_404(session, field_id)
    return vegetation_service.get_vegetation(session, field=field, mode=_resolve_mode(mode))
