"""Demo-trial payloads shared by every field-scoped tool.

The response carries the trial's real location and field defaults so the UI can
label the button and prefill the field form. It never carries a computed NDVI,
moisture or health value: each page runs its own live analysis after the trial
field is materialised.
"""

from typing import Any

from pydantic import BaseModel

from app.schemas.farmer import FarmerIntent


class DemoTrialOut(BaseModel):
    key: str
    name: str
    name_ar: str
    description: str
    description_ar: str
    latitude: float
    longitude: float
    geometry: dict[str, Any]
    crop_id: str
    intent: FarmerIntent
    soil_texture: str
    irrigation_system: str
    area_ha: float
    planting_offset_days: int
