"""Deterministic crop suitability screening.

The engine combines three retrieved inputs: the crop's reference requirements,
modelled SoilGrids properties and Open-Meteo climate history. It returns scored
factors, risks and recommendations, each tied to the values that produced it.
It never predicts yield and never invents a missing input.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from typing import Any

from app.crops import get_calendar
from app.crops.requirements import get_requirements

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

TEXTURE_WATER_HOLDING = {
    "sand": "very low",
    "loamy sand": "low",
    "sandy loam": "moderately low",
    "loam": "moderate",
    "silt loam": "moderate to high",
    "silt": "high",
    "clay loam": "high",
    "sandy clay loam": "moderate",
    "silty clay loam": "high",
    "sandy clay": "moderate",
    "silty clay": "high",
    "clay": "high",
}


def _round(value: float | None, digits: int = 1) -> float | None:
    return round(value, digits) if value is not None else None


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _months_until(target_months: tuple[int, ...], current_month: int) -> int | None:
    if not target_months:
        return None
    distances = [(month - current_month) % 12 for month in target_months]
    return min(distances) if distances else None


def _factor(
    key: str,
    label: str,
    score: float,
    maximum: float,
    status: str,
    explanation: str,
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "score": round(score, 1),
        "max": maximum,
        "status": status,
        "explanation": explanation,
    }


def _monthly_means(history: dict[str, Any]) -> dict[int, dict[str, float]]:
    buckets: dict[int, dict[str, list[float]]] = defaultdict(lambda: {"temp": [], "rain": [], "et0": []})
    for entry in history.get("monthly", []):
        if not entry.get("complete"):
            continue
        month = int(entry["month"])
        if entry.get("temp_mean_c") is not None:
            buckets[month]["temp"].append(entry["temp_mean_c"])
        if entry.get("precipitation_mm") is not None:
            buckets[month]["rain"].append(entry["precipitation_mm"])
        if entry.get("et0_mm") is not None:
            buckets[month]["et0"].append(entry["et0_mm"])
    return {
        month: {
            "temp_mean_c": _mean(values["temp"]),
            "precipitation_mm": _mean(values["rain"]),
            "et0_mm": _mean(values["et0"]),
        }
        for month, values in buckets.items()
    }


def _season_water_reference(
    requirements: Any,
    calendar: Any,
    monthly: dict[int, dict[str, float]],
    planting_month: int,
) -> dict[str, Any] | None:
    months_needed = max(1, math.ceil(calendar.season_days / 30))
    et0_total = 0.0
    rain_total = 0.0
    counted = 0
    for offset in range(months_needed):
        month = (planting_month - 1 + offset) % 12 + 1
        entry = monthly.get(month)
        if not entry:
            continue
        if entry.get("et0_mm") is not None:
            et0_total += entry["et0_mm"]
        if entry.get("precipitation_mm") is not None:
            rain_total += entry["precipitation_mm"]
        counted += 1
    if counted == 0 or et0_total <= 0:
        return None
    etc_total = et0_total * requirements.kc_mid
    effective_rain = rain_total * 0.8
    net_irrigation = max(0.0, etc_total - effective_rain)
    return {
        "season_days": calendar.season_days,
        "months_used": counted,
        "et0_total_mm": round(et0_total),
        "etc_estimate_mm": round(etc_total),
        "rain_total_mm": round(rain_total),
        "effective_rain_mm": round(effective_rain),
        "net_irrigation_estimate_mm": round(net_irrigation),
        "reference_range_mm": [requirements.season_water_min_mm, requirements.season_water_max_mm],
        "method": (
            "ETc ≈ seasonal ET₀ × Kc(mid) minus 80% of seasonal rainfall; a reference "
            "estimate, not an irrigation schedule. Soil water storage and irrigation "
            "efficiency are not included."
        ),
    }


def assess_crop(
    crop_id: str,
    *,
    latitude: float,
    longitude: float,
    soil: dict[str, Any] | None,
    history: dict[str, Any] | None,
    current: dict[str, Any] | None,
    month: int | None = None,
) -> dict[str, Any]:
    """Return a scored, explainable suitability screening for one crop."""
    crop_key = crop_id.strip().lower()
    calendar = get_calendar(crop_key)
    requirements = get_requirements(crop_key)
    if calendar is None or requirements is None:
        return {
            "available": False,
            "crop_id": crop_key,
            "reason": "This crop is not in the reference registry, so no suitability screening is produced.",
        }

    today = date.today()
    current_month = month or today.month
    history = history if history and history.get("available") else None
    monthly = _monthly_means(history) if history else {}

    factors: list[dict[str, Any]] = []
    risks: list[dict[str, Any]] = []
    recommendations: list[dict[str, Any]] = []
    sources: list[str] = ["crop-reference"]

    # 1. Planting window -----------------------------------------------------
    if current_month in calendar.ideal_planting_months:
        window_score, window_status = 15.0, "good"
        window_text = f"{MONTH_NAMES[current_month - 1]} is inside the ideal planting window."
    elif current_month in calendar.acceptable_planting_months:
        window_score, window_status = 8.0, "marginal"
        window_text = f"{MONTH_NAMES[current_month - 1]} is acceptable but not ideal."
    else:
        window_score, window_status = 2.0, "poor"
        window_text = f"{MONTH_NAMES[current_month - 1]} is outside the regional planting window."
    factors.append(_factor("planting_window", "Planting window", window_score, 15, window_status, window_text))
    if window_score < 15:
        ideal_labels = ", ".join(MONTH_NAMES[month - 1] for month in calendar.ideal_planting_months)
        wait = _months_until(calendar.ideal_planting_months, current_month)
        recommendations.append(
            {
                "text": f"The regional ideal sowing month is {ideal_labels}"
                + (f" (about {wait} month(s) from now)." if wait is not None else "."),
                "basis": "Egyptian extension planting calendar; varieties and microclimate can shift the window.",
                "sources": ["crop-reference"],
            }
        )

    # 2. Temperature suitability --------------------------------------------
    temp_values = [
        monthly[month]["temp_mean_c"]
        for month in calendar.ideal_planting_months
        if monthly.get(month, {}).get("temp_mean_c") is not None
    ]
    reference_temp = _mean(temp_values) if temp_values else None
    if reference_temp is None and history:
        daily_temps = [day["t_mean_c"] for day in history.get("daily", [])[-30:] if day.get("t_mean_c") is not None]
        reference_temp = _mean(daily_temps)
        temp_basis = "last 30 archive days"
    else:
        temp_basis = "historical mean for the ideal planting month(s)"
    if reference_temp is None:
        factors.append(_factor("temperature", "Temperature suitability", 0, 25, "unknown", "No historical temperature data was available."))
        sources.append("open-meteo-archive")
    else:
        low, high = calendar.optimal_temp_min_c, calendar.optimal_temp_max_c
        if low <= reference_temp <= high:
            temp_score, status = 25.0, "good"
        elif reference_temp < low:
            gap = low - reference_temp
            temp_score, status = (18.0 if gap <= 3 else 10.0 if gap <= 6 else 4.0), "marginal" if gap <= 3 else "poor"
        else:
            gap = reference_temp - high
            temp_score, status = (18.0 if gap <= 3 else 10.0 if gap <= 6 else 4.0), "marginal" if gap <= 3 else "poor"
        factors.append(
            _factor(
                "temperature",
                "Temperature suitability",
                temp_score,
                25,
                status,
                f"Reference temperature {reference_temp:.1f}°C ({temp_basis}) vs optimal "
                f"{low:.0f}-{high:.0f}°C.",
            )
        )
        sources.append("open-meteo-archive")
        if temp_score < 25:
            recommendations.append(
                {
                    "text": f"Choose a sowing date whose historical mean is within {low:.0f}-{high:.0f}°C; "
                    f"the current reference is {reference_temp:.1f}°C.",
                    "basis": "Crop temperature range from the reference registry.",
                    "sources": ["crop-reference", "open-meteo-archive"],
                }
            )

    # 3. Recent heat and frost exposure -------------------------------------
    recent_days = history.get("daily", [])[-30:] if history else []
    heat_days = sum(
        1 for day in recent_days
        if day.get("t_max_c") is not None and day["t_max_c"] >= calendar.heat_threshold_c
    )
    frost_days = sum(
        1 for day in recent_days
        if day.get("t_min_c") is not None and day["t_min_c"] <= calendar.frost_threshold_c
    )
    if heat_days:
        risks.append(
            {
                "key": "heat",
                "level": "high" if heat_days >= 10 else "moderate",
                "text": f"{heat_days} of the last 30 archive days reached {calendar.heat_threshold_c:.0f}°C or more.",
                "sources": ["open-meteo-archive"],
            }
        )
    if frost_days:
        risks.append(
            {
                "key": "frost",
                "level": "high" if frost_days >= 3 else "moderate",
                "text": f"{frost_days} of the last 30 archive days dropped to {calendar.frost_threshold_c:.0f}°C or below.",
                "sources": ["open-meteo-archive"],
            }
        )

    # 4. Soil pH --------------------------------------------------------------
    topsoil = (soil or {}).get("topsoil") or {}
    ph = topsoil.get("ph")
    if ph is None:
        factors.append(_factor("soil_ph", "Soil pH", 0, 15, "unknown", "SoilGrids returned no pH value for this point."))
    else:
        if requirements.ph_min <= ph <= requirements.ph_max:
            ph_score, ph_status = 15.0, "good"
        elif requirements.ph_min - 0.5 <= ph <= requirements.ph_max + 0.5:
            ph_score, ph_status = 10.0, "marginal"
        elif requirements.ph_min - 1.0 <= ph <= requirements.ph_max + 1.0:
            ph_score, ph_status = 5.0, "marginal"
        else:
            ph_score, ph_status = 0.0, "poor"
        factors.append(
            _factor(
                "soil_ph",
                "Soil pH",
                ph_score,
                15,
                ph_status,
                f"Modelled topsoil pH {ph:.1f} vs reference range {requirements.ph_min:.1f}-{requirements.ph_max:.1f}.",
            )
        )
        sources.append("soilgrids")
        if ph_score < 15:
            direction = "above" if ph > requirements.ph_max else "below"
            recommendations.append(
                {
                    "text": f"Topsoil pH {ph:.1f} is {direction} the reference range "
                    f"{requirements.ph_min:.1f}-{requirements.ph_max:.1f}; confirm with a soil test before amending.",
                    "basis": "SoilGrids modelled pH; a laboratory test is the authoritative source.",
                    "sources": ["soilgrids"],
                }
            )

    # 5. Texture --------------------------------------------------------------
    texture = ((soil or {}).get("texture") or {}).get("class") or "unknown"
    if texture in requirements.preferred_textures:
        texture_score, texture_status = 15.0, "good"
    elif texture in requirements.tolerable_textures:
        texture_score, texture_status = 8.0, "marginal"
    elif texture == "unknown":
        texture_score, texture_status = 0.0, "unknown"
    else:
        texture_score, texture_status = 3.0, "poor"
    factors.append(
        _factor(
            "soil_texture",
            "Soil texture",
            texture_score,
            15,
            texture_status,
            f"Modelled texture class '{texture}'."
            + (f" Water holding is {TEXTURE_WATER_HOLDING[texture]}." if texture in TEXTURE_WATER_HOLDING else ""),
        )
    )
    if texture != "unknown":
        sources.append("soilgrids")
    if texture in {"sand", "loamy sand", "sandy loam"}:
        risks.append(
            {
                "key": "low_water_holding",
                "level": "moderate",
                "text": "Sandy topsoil holds little water; frequent, smaller irrigation applications are usually needed.",
                "sources": ["soilgrids"],
            }
        )
        recommendations.append(
            {
                "text": "Split irrigation into smaller, more frequent applications and add organic matter to improve water holding.",
                "basis": "Texture class from SoilGrids (modelled).",
                "sources": ["soilgrids"],
            }
        )

    # 6. Organic carbon -------------------------------------------------------
    soc = topsoil.get("organic_carbon_g_kg")
    if soc is None:
        factors.append(_factor("organic_carbon", "Organic carbon", 0, 10, "unknown", "SoilGrids returned no organic carbon value."))
    else:
        if soc >= 20:
            soc_score, soc_status = 10.0, "good"
        elif soc >= 10:
            soc_score, soc_status = 7.0, "marginal"
        elif soc >= 5:
            soc_score, soc_status = 4.0, "marginal"
        else:
            soc_score, soc_status = 2.0, "poor"
        factors.append(
            _factor(
                "organic_carbon",
                "Organic carbon",
                soc_score,
                10,
                soc_status,
                f"Modelled topsoil organic carbon {soc:.1f} g/kg.",
            )
        )
        sources.append("soilgrids")
        if soc < 10:
            recommendations.append(
                {
                    "text": f"Organic carbon is low ({soc:.1f} g/kg); compost or manure can improve structure and water holding.",
                    "basis": "SoilGrids modelled organic carbon; confirm with a soil test.",
                    "sources": ["soilgrids"],
                }
            )

    # 7. Water availability ---------------------------------------------------
    yearly = history.get("yearly", []) if history else []
    annual_rain_values = [
        entry["precipitation_mm"]
        for entry in yearly
        if entry.get("complete") and entry.get("precipitation_mm") is not None
    ]
    annual_rain = _mean(annual_rain_values)
    reference_planting_month = calendar.ideal_planting_months[0]
    water_reference = (
        _season_water_reference(requirements, calendar, monthly, reference_planting_month)
        if monthly
        else None
    )
    if annual_rain is None:
        factors.append(_factor("water", "Water availability", 0, 20, "unknown", "No complete annual rainfall history was available."))
    else:
        ratio = annual_rain / requirements.season_water_min_mm if requirements.season_water_min_mm else 0
        if ratio >= 1.0:
            water_score, water_status = 20.0, "good"
        elif ratio >= 0.5:
            water_score, water_status = 14.0, "marginal"
        elif ratio >= 0.25:
            water_score, water_status = 9.0, "marginal"
        else:
            water_score, water_status = 6.0, "poor"
        factors.append(
            _factor(
                "water",
                "Water availability",
                water_score,
                20,
                water_status,
                f"Mean annual archive rainfall {annual_rain:.0f} mm vs reference seasonal need "
                f"{requirements.season_water_min_mm:.0f}-{requirements.season_water_max_mm:.0f} mm. "
                "The score assumes irrigation is available; rainfall alone is not treated as sufficient.",
            )
        )
        sources.append("open-meteo-archive")
        if ratio < 0.5:
            recommendations.append(
                {
                    "text": f"Plan supplemental irrigation: average rainfall ({annual_rain:.0f} mm/year) covers less than half "
                    f"of the reference seasonal water need ({requirements.season_water_min_mm:.0f}-"
                    f"{requirements.season_water_max_mm:.0f} mm).",
                    "basis": "Rainfall from the historical archive; crop water range from FAO-56 references.",
                    "sources": ["open-meteo-archive", "crop-reference"],
                }
            )
    if water_reference:
        risks.append(
            {
                "key": "irrigation_demand",
                "level": "high" if water_reference["net_irrigation_estimate_mm"] > requirements.season_water_max_mm else "moderate",
                "text": f"Estimated net irrigation need is about {water_reference['net_irrigation_estimate_mm']} mm for the season "
                "(reference estimate, not a schedule).",
                "sources": ["open-meteo-archive", "crop-reference"],
            }
        )

    # 8. Salinity (not measured remotely) ------------------------------------
    if requirements.salinity_tolerance == "low":
        risks.append(
            {
                "key": "salinity",
                "level": "unknown",
                "text": "This crop has low salinity tolerance; soil salinity is not measured by these sources. A soil test is required.",
                "sources": ["crop-reference"],
            }
        )

    total = sum(factor["score"] for factor in factors)
    maximum = sum(factor["max"] for factor in factors)
    percentage = round(total / maximum * 100) if maximum else 0
    if percentage >= 75:
        verdict = "suitable"
    elif percentage >= 50:
        verdict = "marginal"
    else:
        verdict = "not_suitable"

    available_inputs = sum(
        1 for item in (soil, history, current)
        if item is not None and item.get("available", True) is not False
    )
    confidence = "high" if available_inputs == 3 else "medium" if available_inputs == 2 else "low"

    return {
        "available": True,
        "crop_id": crop_key,
        "crop_name": calendar.name,
        "latitude": round(latitude, 4),
        "longitude": round(longitude, 4),
        "verdict": verdict,
        "score": percentage,
        "score_max": 100,
        "confidence": confidence,
        "planting": {
            "ideal_months": [MONTH_NAMES[month - 1] for month in calendar.ideal_planting_months],
            "acceptable_months": [MONTH_NAMES[month - 1] for month in calendar.acceptable_planting_months],
            "season_days": calendar.season_days,
            "establishment": calendar.establishment,
            "note": calendar.note,
        },
        "reference_temperature_c": _round(reference_temp),
        "soil": {
            "texture": texture,
            "ph": ph,
            "organic_carbon_g_kg": soc,
        },
        "water_reference": water_reference,
        "factors": factors,
        "risks": risks,
        "recommendations": recommendations,
        "sources": sorted(set(sources)),
        "limitations": [
            "This is a screening score from modelled soil and reanalysis climate, not a field trial or a yield prediction.",
            "Crop ranges are regional/FAO-56 references; local varieties and microclimate can shift them.",
            "The water score assumes irrigation is available and does not estimate irrigation efficiency.",
            "Soil salinity, depth to water table, pests and diseases are not measured by these sources.",
        ],
        "generated_at": date.today().isoformat(),
    }
