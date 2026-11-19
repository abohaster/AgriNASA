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
    RobotSoilMoistureOut,
    WaterBalanceSummary,
    WaterRequirementOut,
)
from app.science.crop_coefficient import days_after_planting, root_depth_m, stage_for_day
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
from app.services import robot as robot_service
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


def _unavailable_robot(reason: str) -> RobotSoilMoistureOut:
    return RobotSoilMoistureOut(
        status="unavailable",
        latest_pct=None,
        measured_at=None,
        sensor_id=None,
        device_label=None,
        measurement_status=None,
        reading_count_24h=0,
        sensor_count=0,
        mean_pct_24h=None,
        min_pct_24h=None,
        max_pct_24h=None,
        latitude=None,
        longitude=None,
        reason=reason,
        note=(
            "A robot probe is the only measured soil-moisture source here. "
            "Model and satellite soil moisture are not substituted for it."
        ),
    )


def _robot_out(moisture) -> RobotSoilMoistureOut:
    return RobotSoilMoistureOut(
        status=moisture.status,
        latest_pct=moisture.latest_pct,
        measured_at=moisture.latest_measured_at,
        sensor_id=moisture.latest_sensor_id,
        device_label=moisture.latest_device_label,
        measurement_status=moisture.measurement_status,
        reading_count_24h=moisture.reading_count_24h,
        sensor_count=moisture.sensor_count,
        mean_pct_24h=moisture.mean_pct_24h,
        min_pct_24h=moisture.min_pct_24h,
        max_pct_24h=moisture.max_pct_24h,
        latitude=moisture.latest_latitude,
        longitude=moisture.latest_longitude,
        reason=moisture.reason,
        note=(
            "Measured by the field robot at one point and depth. It does not "
            "represent the whole field; several readings are summarised only "
            "when they exist."
        ),
    )


def _no_water_requirement(reason: str, confidence: str = "low") -> WaterRequirementOut:
    return WaterRequirementOut(
        status="insufficient_data",
        method="none",
        net_mm=None,
        gross_mm=None,
        volume_m3=None,
        area_ha=None,
        assumptions=[],
        reason=reason,
        confidence=confidence,  # type: ignore[arg-type]
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
    robot: RobotSoilMoistureOut | None = None,
    moisture_assessment: str = "unknown",
    irrigation_needed: bool | None = None,
    water_requirement: WaterRequirementOut | None = None,
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
        robot_soil_moisture=robot
        or _unavailable_robot("No current robot soil-moisture reading is available."),
        moisture_assessment=moisture_assessment,  # type: ignore[arg-type]
        irrigation_needed=irrigation_needed,
        water_requirement=water_requirement
        or _no_water_requirement(
            "Insufficient data to estimate water requirement for this analysis date."
        ),
    )


def _build_water_requirement(
    *,
    probe,
    soil,
    crop,
    stage: GrowthStageOut,
    field: Field,
    robot_fresh: bool,
    bucket_net_mm: float | None,
    bucket_gross_mm: float | None,
    bucket_confidence: str,
) -> WaterRequirementOut:
    """Estimate a refill volume from the best available evidence.

    The probe measures moisture, not litres. Any volume is computed from the
    probe value plus soil and rooting assumptions, and is always labelled an
    estimate.
    """
    area_ha = field.area_ha
    efficiency_note = (
        "Application efficiency is the FAO-typical value for the selected irrigation system."
        if field.irrigation_system
        else "No irrigation system was provided, so only a net depth is reported."
    )

    if robot_fresh and probe is not None and probe.latest_pct is not None:
        theta = max(0.0, min(1.0, probe.latest_pct / 100.0))
        depth_m = root_depth_m(crop, stage.progress)
        deficit_mm = max(0.0, soil.field_capacity - theta) * depth_m * 1000.0
        net_mm, gross_mm, _efficiency = refill_requirements(
            depletion_mm=deficit_mm, irrigation_system=field.irrigation_system
        )
        volume = round(gross_mm * area_ha * 10.0, 1) if gross_mm is not None and area_ha else None
        return WaterRequirementOut(
            status="estimated",
            method="robot_soil_moisture",
            net_mm=net_mm,
            gross_mm=gross_mm,
            volume_m3=volume,
            area_ha=area_ha,
            assumptions=[
                (
                    f"The robot probe reading ({probe.latest_pct:.1f}%) is treated as "
                    "volumetric water content at the probe's location and depth."
                ),
                (
                    f"Refill target is field capacity for the {soil.texture.replace('_', ' ')} "
                    "texture class; wilting point and field capacity are class averages."
                ),
                (
                    f"Rooting depth is the crop-model estimate for this growth stage "
                    f"({depth_m:.2f} m)."
                ),
                "One probe reading does not represent the whole field; the volume is "
                "a refill estimate for the probed zone, not a prescription for every spot.",
                efficiency_note,
                "The probe measures soil moisture; the water volume is calculated, not measured.",
            ],
            reason=None,
            confidence="medium" if field.soil_texture else "low",
        )

    if bucket_net_mm is not None:
        net_mm, gross_mm, _efficiency = refill_requirements(
            depletion_mm=bucket_net_mm, irrigation_system=field.irrigation_system
        )
        volume = round(gross_mm * area_ha * 10.0, 1) if gross_mm is not None and area_ha else None
        return WaterRequirementOut(
            status="estimated",
            method="root_zone_balance",
            net_mm=net_mm,
            gross_mm=gross_mm,
            volume_m3=volume,
            area_ha=area_ha,
            assumptions=[
                "No current robot soil-moisture reading is available, so this estimate "
                "comes from the FAO-56 root-zone balance driven by coarse-grid weather.",
                "No irrigation events are recorded; the value is a refill requirement, not applied water.",
                "Initial root-zone depletion is assumed to be 50% of total available water at planting.",
                efficiency_note,
            ],
            reason=None,
            confidence=bucket_confidence,  # type: ignore[arg-type]
        )

    return _no_water_requirement(
        "Insufficient data to estimate water requirement. A current robot "
        "soil-moisture reading and/or a complete root-zone water balance is required."
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

    if env.is_demo:
        probe = None
        robot_reading = _unavailable_robot(
            "Demo mode replays a cached weather snapshot; live robot readings are "
            "not mixed into demo results."
        )
    else:
        probe = robot_service.field_moisture(session, field.id)
        robot_reading = _robot_out(probe)

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
            robot=robot_reading,
            water_requirement=_no_water_requirement(
                "The season has ended, so no irrigation water requirement is estimated."
            ),
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
            robot=robot_reading,
            water_requirement=_no_water_requirement(
                "The field is not planted yet, so no irrigation water requirement is estimated."
            ),
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

    robot_fresh = bool(probe and probe.available_for_decision)
    if coverage < MIN_ET0_COVERAGE and not robot_fresh:
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
            robot=robot_reading,
            water_requirement=_no_water_requirement(
                "Insufficient data to estimate water requirement: either the weather "
                "inputs are incomplete or no current robot soil-moisture reading exists."
            ),
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

    # The robot probe is the primary evidence when it is current: it measures
    # the actual soil at one point, whereas the bucket is a coarse-grid model.
    sensor_depletion: float | None = None
    moisture_assessment: str = "unknown"
    irrigation_needed: bool | None = None
    if robot_fresh and probe is not None and probe.latest_pct is not None:
        theta = max(0.0, min(1.0, probe.latest_pct / 100.0))
        field_capacity = soil.field_capacity
        wilting_point = soil.wilting_point
        if field_capacity > wilting_point:
            rew = (theta - wilting_point) / (field_capacity - wilting_point)
            rew = max(0.0, min(1.0, rew))
            sensor_depletion = 1.0 - rew
            moisture_assessment = (
                "sufficient" if rew >= 0.55 else "marginal" if rew >= 0.30 else "low"
            )
            irrigation_needed = sensor_depletion >= crop.depletion_fraction_p
        demand_base = classify_demand(
            depletion_fraction=sensor_depletion,
            precipitation_last_7d_mm=rain_7d,
            etc_mm_day=latest_etc,
            stress_days=0,
            moderate_fraction=crop.depletion_fraction_p,
            crop_name=crop.name,
        )
        demand = DemandClassification(
            level=demand_base.level,
            reasons=[
                (
                    f"Robot probe reading: {probe.latest_pct:.1f}% volumetric water at the "
                    f"sensor location ({probe.latest_measured_at or 'time unknown'}). "
                    "Relative extractable water is "
                    + (f"{rew * 100:.0f}%" if sensor_depletion is not None else "unknown")
                    + "."
                ),
                (
                    "This is one measurement point, not a whole-field average. "
                    "The root-zone weather balance is shown separately."
                ),
                *demand_base.reasons,
            ],
        )
    else:
        demand = classify_demand(
            depletion_fraction=balance.depletion_fraction,
            precipitation_last_7d_mm=rain_7d,
            etc_mm_day=latest_etc,
            stress_days=balance.stress_days,
            moderate_fraction=crop.depletion_fraction_p,
            crop_name=crop.name,
        )
        if probe is not None and probe.status == "stale":
            demand = DemandClassification(
                level=demand.level,
                reasons=[
                    "Robot data unavailable: the latest probe reading is stale, so the "
                    "demand class comes from the root-zone weather balance.",
                    *demand.reasons,
                ],
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

    water_requirement = _build_water_requirement(
        probe=probe,
        soil=soil,
        crop=crop,
        stage=stage_out,
        field=field,
        robot_fresh=robot_fresh,
        bucket_net_mm=balance.final_depletion_mm,
        bucket_gross_mm=gross_requirement,
        bucket_confidence=confidence.level,
    )

    if robot_fresh and probe is not None:
        limits.append(
            "Robot soil moisture is a single probe point, not a whole-field average; "
            "spatial variability is not measured."
        )
    elif probe is not None and probe.status == "stale":
        limits.append(
            "Robot data unavailable: the latest probe reading is older than the freshness "
            "window, so the root-zone weather balance drives this analysis."
        )
    elif env.is_demo:
        limits.append(
            "Robot data unavailable in demo mode: the cached snapshot contains no live "
            "robot readings."
        )

    latest_soil_wetness = _latest_value(points, "soil_moisture_root_fraction")
    latest_soil_wetness_date = _latest_value_date(points, "soil_moisture_root_fraction")

    drivers: list[Driver] = [
        Driver(
            key="robot_soil_moisture",
            label="Robot soil moisture",
            value=probe.latest_pct if robot_fresh and probe is not None else None,
            unit="% volumetric",
            interpretation=(
                f"Measured by the robot on {probe.latest_measured_at} at the sensor location; "
                "this is the primary irrigation signal."
                if robot_fresh and probe is not None
                else (
                    "Robot data unavailable: no current probe reading; not replaced with "
                    "modelled or satellite values."
                )
            ),
        ),
        Driver(
            key="moisture_assessment",
            label="Is moisture sufficient?",
            value=moisture_assessment,
            unit=None,
            interpretation=(
                "Sufficient: extractable water is above 55% of the refill range."
                if moisture_assessment == "sufficient"
                else (
                    "Marginal: extractable water is between 30% and 55%."
                    if moisture_assessment == "marginal"
                    else (
                        "Low: extractable water is below 30%; refill is likely needed."
                        if moisture_assessment == "low"
                        else "Unknown: no current robot reading, so sufficiency cannot be measured."
                    )
                )
            ),
        ),
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
        confidence=ConfidenceOut(
            level=confidence.level,
            reasons=[
                *confidence.reasons,
                (
                    "A current robot soil-moisture reading anchors this analysis."
                    if robot_fresh
                    else (
                        "No current robot soil-moisture reading; the estimate relies on "
                        "coarse-grid weather and modelled soil water."
                    )
                ),
            ],
        ),
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
        robot_soil_moisture=robot_reading,
        moisture_assessment=moisture_assessment,
        irrigation_needed=irrigation_needed,
        water_requirement=water_requirement,
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
