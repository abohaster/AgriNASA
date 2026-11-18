"""
Irrigation service: combines environment data with FAO-56 science.

INPUT  → field profile (crop, planting date, soil texture, irrigation system)
PROCESS→ environment window → daily ET₀ → stage Kc → ETc → root-zone bucket
OUTPUT → an auditable IrrigationAnalysis (class, reasons, confidence, limits)

The service never writes a water recommendation as free text. The assistant may
explain this object, but the numbers come from deterministic functions.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.config import get_settings
from app.crops import get_crop
from app.data_catalog import GLOBAL_LIMITATIONS, source_ref
from app.db import repository
from app.db.models import Field
from app.exceptions import ValidationFailure
from app.schemas.irrigation import (
    BalanceDayOut,
    ConfidenceOut,
    Driver,
    GrowthStageOut,
    IrrigationAnalysis,
    WaterBalanceSummary,
)
from app.science.crop_coefficient import days_after_planting, stage_for_day
from app.science.interfaces import ConfidenceResult, DemandClassification
from app.science.irrigation import (
    ConfidenceFactors,
    assess_confidence,
    classify_demand,
    refill_requirements,
)
from app.science.water_balance import (
    BalanceDayInput,
    BalanceResult,
    get_soil_properties,
    simulate_water_balance,
)
from app.services import environment as environment_service
from app.services.processing import recent_precipitation_total

MIN_ET0_COVERAGE = 0.80


def _latest_value(points: list[dict], variable: str) -> float | None:
    for point in reversed(points):
        value = point.get(variable)
        if value is not None:
            return float(value)
    return None


def _latest_value_date(points: list[dict], variable: str) -> str | None:
    for point in reversed(points):
        if point.get(variable) is not None:
            return point["date"]
    return None


def _balance_summary(result: BalanceResult | None) -> WaterBalanceSummary:
    if result is None:
        return WaterBalanceSummary(
            depletion_mm=None,
            taw_mm=None,
            raw_mm=None,
            depletion_fraction=None,
            stress_days=0,
            initial_depletion_mm=None,
            runoff_mm=None,
            drainage_mm=None,
            days_simulated=0,
            excluded_et0_days=0,
        )
    return WaterBalanceSummary(
        depletion_mm=result.final_depletion_mm,
        taw_mm=result.taw_mm,
        raw_mm=result.raw_mm,
        depletion_fraction=result.depletion_fraction,
        stress_days=result.stress_days,
        initial_depletion_mm=result.initial_depletion_mm,
        runoff_mm=result.runoff_total_mm,
        drainage_mm=result.drainage_total_mm,
        days_simulated=result.days_simulated,
        excluded_et0_days=result.excluded_et0_days,
    )


def _stage_out(stage) -> GrowthStageOut:
    return GrowthStageOut(
        code=stage.code,
        name=stage.name,
        days_after_planting=stage.days_after_planting,
        progress=stage.progress,
        kc=stage.kc,
    )


def _insufficient(
    *,
    stage: GrowthStageOut | None,
    balance: BalanceResult | None,
    computed_for: date,
    reasons: list[str],
    limits: list[str],
    is_demo: bool,
    missing_inputs: list[str],
    season_complete: bool = False,
) -> IrrigationAnalysis:
    return IrrigationAnalysis(
        status="insufficient_data",
        season_complete=season_complete,
        demand="unknown",
        demand_reasons=reasons,
        confidence=ConfidenceOut(level="low", reasons=reasons),
        computed_for=computed_for,
        stage=stage,
        et0_mm_day=None,
        kc=stage.kc if stage else None,
        etc_mm_day=None,
        balance=_balance_summary(balance),
        balance_series=_balance_series(balance),
        net_requirement_mm=None,
        gross_requirement_mm=None,
        application_efficiency=None,
        drivers=[],
        missing_inputs=missing_inputs,
        limitations=limits,
        source=source_ref("derived-power"),
        is_demo=is_demo,
    )


def _balance_series(result: BalanceResult | None) -> list[BalanceDayOut]:
    if result is None:
        return []
    return [
        BalanceDayOut(
            date=record.day,
            depletion_mm=record.depletion_mm,
            taw_mm=record.taw_mm,
            raw_mm=record.raw_mm,
            etc_mm_day=record.etc_mm_day,
            precipitation_mm=record.precipitation_mm,
            stressed=record.stressed,
        )
        for record in result.records
    ]


def analyze_irrigation(
    session: Session,
    *,
    field: Field,
    end: date | None = None,
    mode: str = "live",
) -> IrrigationAnalysis:
    """Run the full irrigation analysis for one field."""
    settings = get_settings()
    crop = get_crop(field.crop_id)
    if crop is None:
        raise ValidationFailure(
            f"Crop '{field.crop_id}' is not supported.",
            details="Only crops registered in backend/app/crops can be analysed.",
        )

    env, processed, series = environment_service.build_environment(
        session, field=field, end=end, mode=mode
    )

    # Demo analyses use the snapshot's planting date because the snapshot's dates
    # are fixed; this is disclosed in the demo notice and API responses.
    analysis_planting = (
        series.demo.planting_date
        if series.is_demo and series.demo is not None
        else field.planting_date
    )
    computed_for = env.end
    planting_iso = analysis_planting.isoformat()

    points = [p for p in processed.points if p["date"] >= planting_iso]
    final_dap = days_after_planting(analysis_planting, computed_for)
    final_stage = stage_for_day(crop, final_dap)
    stage_out = _stage_out(final_stage)

    base_limitations = [
        GLOBAL_LIMITATIONS[0],
        "Baseline assumes no recorded irrigation events (I = 0); the output is a refill requirement, not applied water.",
        "Initial root-zone depletion is assumed to be 50% of total available water at planting.",
        f"Runoff is approximated as {crop.runoff_coefficient * 100:.0f}% of daily rainfall because slope and cover data are unavailable.",
        "Demand thresholds are documented agronomic heuristics, not a validated field prescription.",
        GLOBAL_LIMITATIONS[1],
    ]
    if env.is_demo and series.demo is not None:
        base_limitations.insert(0, series.demo.notice)
    base_limitations.extend(environment_service.trim_limitations(env))

    if final_stage.code == "post_harvest":
        season_end = analysis_planting + timedelta(days=crop.season_length_days)
        return _insufficient(
            stage=stage_out,
            balance=None,
            computed_for=computed_for,
            reasons=[
                f"The {crop.name.lower()} season ({crop.season_length_days} days) ended on "
                f"{season_end.isoformat()}; irrigation demand is not assessed after harvest.",
                "Create a new field with the next planting date to analyse the new season.",
            ],
            limits=base_limitations
            + ["Weather after harvest is not crop water demand, so no demand class is shown."],
            is_demo=env.is_demo,
            missing_inputs=[],
            season_complete=True,
        )

    if not points:
        return _insufficient(
            stage=stage_out,
            balance=None,
            computed_for=computed_for,
            reasons=[
                "The field has not been planted as of the analysis date, so no crop water balance exists."
            ],
            limits=base_limitations,
            is_demo=env.is_demo,
            missing_inputs=["Days after planting must be ≥ 0."],
        )

    et0_available = sum(1 for p in points if p["et0_mm_day"] is not None)
    coverage = et0_available / len(points)
    precip_coverage = sum(1 for p in points if p["precipitation_mm"] is not None) / len(points)

    soil = get_soil_properties(field.soil_texture)
    soil_provided = field.soil_texture is not None

    balance_inputs = [
        BalanceDayInput(
            day=date.fromisoformat(p["date"]),
            days_after_planting=days_after_planting(analysis_planting, date.fromisoformat(p["date"])),
            precipitation_mm=p["precipitation_mm"],
            et0_mm_day=p["et0_mm_day"],
        )
        for p in points
    ]
    balance = simulate_water_balance(profile=crop, soil=soil, days=balance_inputs)

    limits = list(base_limitations)
    if not soil_provided:
        limits.append(
            "Soil texture was not provided; loam defaults (field capacity 0.29, wilting point 0.14) were used."
        )
    if coverage < 1.0:
        limits.append(
            f"ET₀ was unavailable on {len(points) - et0_available} day(s); those days were simulated "
            "without crop water use rather than filled with estimated weather."
        )
    if not settings.vegetation_configured:
        limits.append("NDVI is unavailable; vegetation condition cannot corroborate the water balance.")

    missing_inputs: list[str] = []
    if coverage < MIN_ET0_COVERAGE:
        missing_inputs.append(
            "Complete ET₀ inputs (Tmax, Tmin, RH, wind, solar) on at least 80% of planting-to-date days"
        )
    last_et0_missing = processed.et0_missing_by_date.get(date.fromisoformat(points[-1]["date"]), [])
    missing_inputs.extend(f"Latest day: {label}" for label in last_et0_missing)
    if precip_coverage < 0.95:
        missing_inputs.append("Complete daily precipitation series")
    if not soil_provided:
        missing_inputs.append("User-provided soil texture")

    if coverage < MIN_ET0_COVERAGE:
        return _insufficient(
            stage=stage_out,
            balance=balance,
            computed_for=computed_for,
            reasons=[
                f"Only {coverage * 100:.0f}% of days had complete ET₀ inputs; at least "
                f"{MIN_ET0_COVERAGE * 100:.0f}% is required for a demand class.",
                "No irrigation class is shown rather than presenting an unreliable recommendation.",
            ],
            limits=limits,
            is_demo=env.is_demo,
            missing_inputs=missing_inputs,
        )

    # Latest crop water use from the most recent complete day.
    latest_et0: float | None = None
    latest_etc: float | None = None
    for point in reversed(points):
        if point["et0_mm_day"] is None:
            continue
        day = date.fromisoformat(point["date"])
        stage = stage_for_day(crop, days_after_planting(analysis_planting, day))
        latest_et0 = round(float(point["et0_mm_day"]), 3)
        latest_etc = round(stage.kc * latest_et0, 3) if stage.kc is not None else None
        break

    rain_7d = recent_precipitation_total(points, 7)
    demand: DemandClassification = classify_demand(
        depletion_fraction=balance.depletion_fraction,
        precipitation_last_7d_mm=rain_7d,
        etc_mm_day=latest_etc,
        stress_days=balance.stress_days,
        moderate_fraction=crop.depletion_fraction_p,
        crop_name=crop.name,
    )
    confidence: ConfidenceResult = assess_confidence(
        ConfidenceFactors(
            et0_coverage=coverage,
            precipitation_coverage=precip_coverage,
            soil_provided=soil_provided,
            irrigation_system_provided=field.irrigation_system is not None,
            days_simulated=balance.days_simulated,
            vegetation_available=settings.vegetation_configured,
        )
    )

    net_requirement, gross_requirement, efficiency = refill_requirements(
        depletion_mm=balance.final_depletion_mm,
        irrigation_system=field.irrigation_system,
    )

    latest_soil_wetness = _latest_value(points, "soil_moisture_root_fraction")
    latest_soil_wetness_date = _latest_value_date(points, "soil_moisture_root_fraction")

    drivers: list[Driver] = [
        Driver(
            key="rain_7d",
            label="Rainfall, last 7 days",
            value=rain_7d,
            unit="mm",
            interpretation=(
                "Recent rainfall recharges the root zone."
                if rain_7d is not None and rain_7d > 0
                else "Little or no rain contributed to the root zone recently."
            )
            if rain_7d is not None
            else "Precipitation coverage is insufficient to total recent rainfall.",
        ),
        Driver(
            key="et0",
            label="Reference ET₀",
            value=latest_et0,
            unit="mm/day",
            interpretation="Atmospheric demand for the latest day with complete inputs.",
        ),
        Driver(
            key="etc",
            label="Crop water use (ETc)",
            value=latest_etc,
            unit="mm/day",
            interpretation=f"Kc {final_stage.kc if final_stage.kc is not None else '—'} × ET₀ for the current stage.",
        ),
        Driver(
            key="depletion",
            label="Root-zone depletion",
            value=round(balance.depletion_fraction * 100, 1),
            unit="% of TAW",
            interpretation=(
                f"{balance.final_depletion_mm:.1f} mm depleted of {balance.taw_mm:.1f} mm total available water."
            ),
        ),
        Driver(
            key="stage",
            label="Growth stage",
            value=final_stage.name,
            unit=None,
            interpretation=f"Day {final_dap} after planting; Kc interpolated by stage.",
        ),
    ]
    if latest_soil_wetness is not None:
        drivers.append(
            Driver(
                key="soil_wetness",
                label="MERRA-2 root-zone wetness",
                value=latest_soil_wetness,
                unit="0–1 fraction",
                interpretation=(
                    f"Model-derived wetness for the grid cell on {latest_soil_wetness_date}; "
                    "context only, not used in the bucket."
                ),
            )
        )

    analysis = IrrigationAnalysis(
        status="ok",
        demand=demand.level,
        demand_reasons=demand.reasons,
        confidence=ConfidenceOut(level=confidence.level, reasons=confidence.reasons),
        computed_for=computed_for,
        stage=stage_out,
        et0_mm_day=latest_et0,
        kc=final_stage.kc,
        etc_mm_day=latest_etc,
        balance=_balance_summary(balance),
        balance_series=_balance_series(balance),
        net_requirement_mm=net_requirement,
        gross_requirement_mm=gross_requirement,
        application_efficiency=efficiency,
        drivers=drivers,
        missing_inputs=missing_inputs,
        limitations=limits,
        source=source_ref("derived-power"),
        is_demo=env.is_demo,
    )

    repository.save_irrigation_snapshot(
        session, field=field, payload=analysis.model_dump(mode="json"), is_demo=env.is_demo
    )
    return analysis
