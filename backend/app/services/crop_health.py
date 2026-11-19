"""
Crop-health service: environmental stress indicators for a registered crop.

Uses the same environment + water balance as the irrigation page, and adds
temperature-based and rainfall-anomaly indicators. Heat, frost and depletion
thresholds come from the crop profile. It never diagnoses disease and never
labels a stress cause beyond what the weather/water data supports.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.crops import get_crop
from app.data_catalog import GLOBAL_LIMITATIONS, source_ref
from app.db import repository
from app.db.models import Field
from app.exceptions import ValidationFailure
from app.schemas.health import (
    CropHealthAnalysis,
    HealthIndicatorOut,
    IndicatorAgreementOut,
    VegetationResponse,
    VegetationSummaryOut,
)
from app.services import environment as environment_service
from app.services import nasa_power, vegetation as vegetation_service
from app.services.irrigation import analyze_irrigation
from app.services.processing import normal_30_day_rainfall_mm, recent_precipitation_total
from app.science.crop_coefficient import days_after_planting, stage_for_day
from app.science.stress import (
    DailyTemperature,
    assess_health,
    frost_indicator,
    heat_stress_indicator,
    rainfall_anomaly_indicator,
    summarise_indicator_agreement,
    vegetation_indicator,
    water_stress_indicator,
)

STATUS_LABELS = {
    "good": "GOOD",
    "moderate": "MODERATE",
    "stressed": "STRESSED",
    "insufficient_data": "INSUFFICIENT DATA",
}


def _vegetation_note(vegetation: VegetationResponse) -> str:
    if vegetation.reason:
        return vegetation.reason
    if vegetation.latest is None:
        return "No vegetation observation is available for this field."
    return (
        f"Sentinel-2 NDVI {vegetation.latest.ndvi:.2f} on {vegetation.latest.date.isoformat()} "
        f"from Google Earth Engine; trend {vegetation.trend}."
    )


def analyze_health(
    session: Session,
    *,
    field: Field,
    end: date | None = None,
    mode: str = "live",
) -> CropHealthAnalysis:
    """Compute environmental stress indicators and an overall status."""
    crop = get_crop(field.crop_id)
    if crop is None:
        raise ValidationFailure(f"Crop '{field.crop_id}' is not supported.")

    env, processed, series = environment_service.build_environment(
        session, field=field, end=end, mode=mode
    )
    irrigation = analyze_irrigation(session, field=field, end=end, mode=mode)
    vegetation = vegetation_service.get_vegetation(session, field=field, mode=mode)

    analysis_planting = (
        series.demo.planting_date
        if series.is_demo and series.demo is not None
        else field.planting_date
    )
    points = [p for p in processed.points if p["date"] >= analysis_planting.isoformat()]
    computed_for = env.end
    dap = days_after_planting(analysis_planting, computed_for)
    stage = stage_for_day(crop, dap)

    if stage.code == "post_harvest":
        season_end = analysis_planting + timedelta(days=crop.season_length_days)
        reason = (
            f"The {crop.name.lower()} season ({crop.season_length_days} days) ended on "
            f"{season_end.isoformat()}; crop health is not assessed after harvest."
        )
        analysis = CropHealthAnalysis(
            status="insufficient_data",
            season_complete=True,
            status_reason=reason,
            indicators=[],
            indicator_agreement=None,
            vegetation=VegetationSummaryOut(
                available=vegetation.available,
                ndvi=vegetation.latest.ndvi if vegetation.latest else None,
                trend=vegetation.trend,
                latest_date=vegetation.latest.date if vegetation.latest else None,
                note=_vegetation_note(vegetation),
            ),
            summary=(
                f"{reason} Create a new field with the next planting date to analyse the new season."
            ),
            missing_inputs=[],
            limitations=[
                "The crop-health module reports environmental stress indicators only; it does not diagnose disease or pests.",
                GLOBAL_LIMITATIONS[0],
                "The crop season has ended; weather after harvest does not describe crop health.",
                *environment_service.trim_limitations(env),
            ],
            source=source_ref("derived-power"),
            is_demo=env.is_demo,
            computed_for=computed_for,
        )
        repository.save_health_snapshot(
            session, field=field, payload=analysis.model_dump(mode="json"), is_demo=env.is_demo
        )
        return analysis

    temperatures = [
        DailyTemperature(
            day=date.fromisoformat(point["date"]),
            tmax_c=point["t2m_max_c"],
            tmin_c=point["t2m_min_c"],
        )
        for point in points
    ]

    # Rainfall anomaly: recent 30 days vs the POWER 1991–2020 normal for the
    # analysis month. The normal is an approximation (30 × monthly mean/day) and
    # is only used as context, never in the water balance.
    climatology = nasa_power.fetch_climatology(
        latitude=field.latitude, longitude=field.longitude, mode=mode
    )
    recent_rain = recent_precipitation_total(points, 30)
    normal_rain = normal_30_day_rainfall_mm(climatology, computed_for)

    indicators = [
        heat_stress_indicator(temperatures, crop.heat_stress_threshold_c),
        frost_indicator(temperatures, crop.frost_threshold_c),
        water_stress_indicator(
            irrigation.balance.depletion_fraction,
            irrigation.balance.stress_days,
            watch_fraction=crop.depletion_fraction_p,
        ),
        rainfall_anomaly_indicator(recent_rain, normal_rain, available_days=len(points)),
        vegetation_indicator(
            available=vegetation.available,
            latest_ndvi=vegetation.latest.ndvi if vegetation.latest else None,
            trend=vegetation.trend,
        ),
    ]

    assessment = assess_health(indicators)
    agreement = summarise_indicator_agreement(indicators)
    indicator_outs = [
        HealthIndicatorOut(
            id=indicator.id,
            label=indicator.label,
            value=indicator.value,
            unit=indicator.unit,
            status=indicator.status,
            interpretation=indicator.interpretation,
        )
        for indicator in indicators
    ]

    known_interpretations = [
        indicator.interpretation for indicator in indicators if indicator.status != "unknown"
    ]
    summary = (
        f"Crop health status: {STATUS_LABELS[assessment.status]}. {assessment.status_reason} "
        + " ".join(known_interpretations[:3])
    )

    missing_inputs = [
        f"{indicator.label} could not be computed."
        for indicator in indicators
        if indicator.status == "unknown"
    ]
    missing_inputs.extend(irrigation.missing_inputs)

    limitations = [
        "The crop-health module reports environmental stress indicators only; it does not diagnose disease or pests.",
        GLOBAL_LIMITATIONS[0],
        "Stress thresholds use the crop's FAO-56 heat and frost limits and its depletion fraction, with stress at 80% of total available water; they are agronomic heuristics, not calibrated yield predictions.",
        "A rainfall anomaly normal is a 30-year monthly climatology, not a forecast for this season.",
        "Water-stress context inherits the coarse resolution and assumptions of the irrigation model.",
    ]
    if not vegetation.available:
        limitations.append(
            "NDVI is unavailable for this field; vegetation condition is not inferred from weather surrogates."
        )
    if env.is_demo and series.demo is not None:
        limitations.insert(0, series.demo.notice)
    limitations.extend(environment_service.trim_limitations(env))

    analysis = CropHealthAnalysis(
        status=assessment.status,
        status_reason=assessment.status_reason,
        indicators=indicator_outs,
        indicator_agreement=IndicatorAgreementOut(
            percent=agreement.percent,
            known=agreement.known,
            total=agreement.total,
            stressed=agreement.stressed,
            definition=(
                "Share of available indicators that are not at stress level. "
                "This is indicator agreement, not a probability of crop health or a yield estimate."
            ),
        ),
        vegetation=VegetationSummaryOut(
            available=vegetation.available,
            ndvi=vegetation.latest.ndvi if vegetation.latest else None,
            trend=vegetation.trend,
            latest_date=vegetation.latest.date if vegetation.latest else None,
            note=_vegetation_note(vegetation),
        ),
        summary=summary,
        missing_inputs=list(dict.fromkeys(missing_inputs)),
        limitations=limitations,
        source=source_ref("derived-power"),
        is_demo=env.is_demo,
        computed_for=computed_for,
    )

    repository.save_health_snapshot(
        session, field=field, payload=analysis.model_dump(mode="json"), is_demo=env.is_demo
    )
    return analysis
