"""Simplified farmer-guide endpoint.

One POST combines NASA POWER weather, Sentinel-1/2 satellite readings and an
Open-Meteo forecast into traffic-light style codes for a non-technical page.
No geometry is saved and no field record is required.

A second GET returns three real Egyptian farm locations used as one-tap
examples. Their polygons are sent back through the same POST, so the demo path
uses exactly the live analysis a farmer's own field would use.
"""

from fastapi import APIRouter, Query

from app.crops import demo_fields
from app.schemas.common import DataMode
from app.schemas.farmer import DemoFieldOut, FarmerSummaryOut, FarmerSummaryRequest
from app.services import farmer_summary as farmer_summary_service

router = APIRouter(tags=["farmer"])


@router.get("/farmer-demo-fields", response_model=list[DemoFieldOut])
def farmer_demo_fields() -> list[DemoFieldOut]:
    return [
        DemoFieldOut(
            id=field.id,
            name=field.name,
            name_ar=field.name_ar,
            description=field.description,
            description_ar=field.description_ar,
            latitude=field.latitude,
            longitude=field.longitude,
            geometry=field.geometry,
            crop_id=field.crop_id,
            intent=field.intent,  # type: ignore[arg-type]
            days_since_planting=field.days_since_planting,
        )
        for field in demo_fields.list_demo_fields()
    ]


@router.post("/farmer-summary", response_model=FarmerSummaryOut)
def farmer_summary(
    payload: FarmerSummaryRequest,
    mode: DataMode = Query(default="live"),
) -> FarmerSummaryOut:
    return farmer_summary_service.build_farmer_summary(
        latitude=payload.latitude,
        longitude=payload.longitude,
        crop_id=payload.crop_id,
        intent=payload.intent,
        mode=mode,
        days_since_planting=payload.days_since_planting,
        geometry=payload.geometry,
    )
