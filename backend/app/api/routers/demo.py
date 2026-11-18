"""One-tap demo fields for every field-scoped analysis tool.

The farmer guide streams coordinates straight into its POST and never saves a
field. The other tools (dashboard, analytics, satellite, crop health,
irrigation, assistant) work on stored field profiles, so this router
materialises the same three real Egyptian locations as clearly labelled demo
fields.

Creation is idempotent: the stable name is the key, and the profile (crop,
soil, irrigation, area, boundary, planting date) is refreshed on every tap so a
trial always matches the code definition and stays in an early-season window.
No satellite, weather or health value is predefined here; each tool still runs
its own live calculation.
"""

import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crops import demo_fields
from app.db import repository
from app.db.database import get_session
from app.db.models import Field
from app.exceptions import NotFoundError
from app.schemas.demo import DemoTrialOut
from app.schemas.fields import FieldOut

router = APIRouter(prefix="/demo-trials", tags=["demo"])

TRIAL_NAME_PREFIX = "Demo trial · "


def _trial_name(trial: demo_fields.DemoField) -> str:
    return f"{TRIAL_NAME_PREFIX}{trial.name}"


def _boundary_text(trial: demo_fields.DemoField) -> str:
    return json.dumps(trial.geometry, separators=(",", ":"))


def _planting_date(trial: demo_fields.DemoField) -> date:
    return date.today() - timedelta(days=trial.planting_offset_days)


@router.get("", response_model=list[DemoTrialOut])
def list_demo_trials() -> list[DemoTrialOut]:
    return [
        DemoTrialOut(
            key=trial.id,
            name=trial.name,
            name_ar=trial.name_ar,
            description=trial.description,
            description_ar=trial.description_ar,
            latitude=trial.latitude,
            longitude=trial.longitude,
            geometry=trial.geometry,
            crop_id=trial.crop_id,
            intent=trial.intent,  # type: ignore[arg-type]
            soil_texture=trial.soil_texture,
            irrigation_system=trial.irrigation_system,
            area_ha=trial.area_ha,
            planting_offset_days=trial.planting_offset_days,
        )
        for trial in demo_fields.list_demo_fields()
    ]


def _materialise(trial: demo_fields.DemoField, session: Session) -> Field:
    name = _trial_name(trial)
    planting_date = _planting_date(trial)
    boundary_text = _boundary_text(trial)

    existing = next((row for row in repository.list_fields(session) if row.name == name), None)
    if existing is not None:
        profile = {
            "crop_id": trial.crop_id,
            "planting_date": planting_date,
            "latitude": trial.latitude,
            "longitude": trial.longitude,
            "area_ha": trial.area_ha,
            "soil_texture": trial.soil_texture,
            "irrigation_system": trial.irrigation_system,
            "boundary_geojson": boundary_text,
        }
        if any(getattr(existing, key) != value for key, value in profile.items()):
            for key, value in profile.items():
                setattr(existing, key, value)
        return existing

    return repository.create_field(
        session,
        values={
            "name": name,
            "crop_id": trial.crop_id,
            "planting_date": planting_date,
            "latitude": trial.latitude,
            "longitude": trial.longitude,
            "area_ha": trial.area_ha,
            "soil_texture": trial.soil_texture,
            "irrigation_system": trial.irrigation_system,
            "location_label": trial.name,
            "boundary_geojson": boundary_text,
        },
        location_source="demo_trial",
    )


def seed_demo_trials(session: Session) -> None:
    """Create (or refresh) every demo trial field. Idempotent by trial name."""
    for trial in demo_fields.list_demo_fields():
        _materialise(trial, session)
    session.commit()


@router.post("/{trial_key}", response_model=FieldOut)
def materialise_demo_trial(
    trial_key: str, session: Session = Depends(get_session)
) -> Field:
    trial = demo_fields.get_demo_field(trial_key)
    if trial is None:
        raise NotFoundError(
            "Unknown demo trial.",
            details="Use one of the keys returned by GET /api/demo-trials.",
        )

    field = _materialise(trial, session)
    session.commit()
    session.refresh(field)
    return field
