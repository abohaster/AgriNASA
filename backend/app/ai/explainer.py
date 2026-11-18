"""
Deterministic explainer — the assistant's no-LLM fallback.

WHY IT EXISTS
-------------
The platform must work without an AI API key, and the AI provider may be
unavailable. Rather than returning an error, we answer from the same structured
context using fixed templates. These answers are fully reproducible: they only
format values that the scientific modules already calculated.

They are intentionally simple and keyword-routed. The language model (when
configured) produces more natural prose, but never different numbers.
"""

from typing import Any

DEMAND_WORDS = (
    "irrigat",
    "water demand",
    "water requirement",
    "how much water",
    "refill",
    "watering",
    "why is demand",
    "demand high",
    "demand moderate",
    "demand low",
)
HEALTH_WORDS = ("health", "stress", "disease", "pest", "vegetation", "ndvi", "crop condition")
RAIN_WORDS = ("rain", "precipitat")
TEMPERATURE_WORDS = ("temperature", "heat", "frost", "cold", "tmax", "tmin")
CLIMATE_WORDS = ("humidity", "wind", "solar", "radiation", "pressure")
CONFIDENCE_WORDS = ("confidence", "uncertain", "reliable", "accuracy", "trust")
ET_WORDS = ("et0", "et₀", "evapotranspiration", "kc", "crop coefficient", "etc mm")
MISSING_WORDS = ("missing", "unavailable", "not available", "no data", "insufficient")


def _fmt(value: Any, unit: str | None = None, digits: int = 1) -> str:
    """Format a provided value without ever substituting a guessed number."""
    if value is None:
        return "not available"
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, float):
        text = f"{value:.{digits}f}"
    else:
        text = str(value)
    return f"{text} {unit}" if unit else text


def _bullets(items: list[str]) -> str:
    return "\n".join(f"• {item}" for item in items if item)


def _latest(context: dict[str, Any], variable: str) -> dict[str, Any] | None:
    for row in context["environment"]["latest_values"]:
        if row["variable"] == variable:
            return row
    return None


def _trend(context: dict[str, Any], variable: str) -> dict[str, Any] | None:
    for row in context["environment"]["trends_last_7_days"]:
        if row["variable"] == variable:
            return row
    return None


def _indicator(context: dict[str, Any], indicator_id: str) -> dict[str, Any] | None:
    for row in context["crop_health"]["indicators"]:
        if row["id"] == indicator_id:
            return row
    return None


def _irrigation_answer(context: dict[str, Any]) -> str:
    irrigation = context["irrigation"]
    field = context["field"]

    if irrigation["status"] != "ok":
        lines = [
            f"Irrigation demand is INSUFFICIENT DATA for {field['name']} as of {field['analysis_date']}.",
            "",
            "The deterministic model did not produce a demand class because:",
            _bullets(irrigation["demand_reasons"][:3]),
        ]
        if irrigation["missing_inputs"]:
            lines += ["", "Missing inputs:", _bullets(irrigation["missing_inputs"][:4])]
        lines += [
            "",
            f"Confidence: {irrigation['confidence']['level'].upper()} — "
            + "; ".join(irrigation["confidence"]["reasons"][:2]),
        ]
        return "\n".join(lines)

    stage = irrigation["growth_stage"] or {}
    lines = [
        f"Irrigation demand is {irrigation['demand_label']} for {field['name']} "
        f"as of {field['analysis_date']}.",
        "",
        "Contributing factors computed by the model:",
        _bullets(irrigation["demand_reasons"]),
        "",
        f"Crop water use: ET₀ {_fmt(irrigation['et0_mm_per_day'], 'mm/day', 2)} × "
        f"Kc {_fmt(irrigation['crop_coefficient_kc'], None, 2)} = "
        f"ETc {_fmt(irrigation['etc_mm_per_day'], 'mm/day', 2)} "
        f"({stage.get('name', 'stage unavailable')}, "
        f"day {stage.get('days_after_planting', '—')} after planting).",
    ]

    if irrigation["net_refill_requirement_mm"] is not None:
        gross = irrigation["gross_refill_requirement_mm"]
        efficiency = irrigation["application_efficiency"]
        line = f"Root-zone refill estimate: {_fmt(irrigation['net_refill_requirement_mm'], 'mm', 1)} net"
        if gross is not None and efficiency is not None:
            line += f" ({_fmt(gross, 'mm', 1)} gross at {efficiency * 100:.0f}% application efficiency)"
        lines += ["", line + ".", irrigation["baseline_note"]]

    lines += [
        "",
        f"Confidence: {irrigation['confidence']['level'].upper()} — "
        + "; ".join(irrigation["confidence"]["reasons"][:2]),
    ]
    return "\n".join(lines)


def _health_answer(context: dict[str, Any], question: str = "") -> str:
    health = context["crop_health"]
    vegetation = context["vegetation"]

    lines = [f"Crop health status: {health['status'].replace('_', ' ').upper()}.", health["status_reason"]]

    notable = [
        indicator
        for indicator in health["indicators"]
        if indicator["status"] in ("watch", "stress")
    ]
    if notable:
        lines += ["", "Indicators needing attention:", _bullets(
            f"{row['label']}: {row['interpretation']}" for row in notable
        )]

    unknown = [row for row in health["indicators"] if row["status"] == "unknown"]
    if unknown:
        lines += ["", "Indicators that could not be computed:", _bullets(
            f"{row['label']}: data unavailable" for row in unknown
        )]

    if vegetation["available"]:
        lines += [
            "",
            f"NDVI is {_fmt(vegetation['latest_ndvi'], None, 2)} "
            f"({vegetation['trend']}); it describes vegetation condition, not a disease.",
        ]
    else:
        lines += ["", "Vegetation index: unavailable. " + (vegetation["reason"] or "")]

    if any(word in question for word in ("disease", "pest", "fungus", "infection", "deficiency")):
        lines += [
            "",
            "I cannot diagnose disease, pests or nutrient deficiency. The indicators above describe "
            "environmental stress only; confirm any suspicion with a local agronomist or a laboratory test.",
        ]

    return "\n".join(lines)


def _rain_answer(context: dict[str, Any]) -> str:
    env = context["environment"]
    recent = env["recent_7_day_precipitation_mm"]
    total = env["window_precipitation_mm"]
    anomaly = _indicator(context, "rainfall_anomaly")

    lines = [
        f"Recent rainfall (last 7 days): {_fmt(recent, 'mm', 1)}.",
        f"Rainfall total for the analysis window "
        f"({env['window']['start']} to {env['window']['end']}): {_fmt(total, 'mm', 1)}.",
    ]
    if anomaly:
        lines += ["", f"Rainfall anomaly: {anomaly['interpretation']}"]
    return "\n".join(lines)


def _temperature_answer(context: dict[str, Any]) -> str:
    mean = _latest(context, "t2m_mean_c")
    tmax = _latest(context, "t2m_max_c")
    tmin = _latest(context, "t2m_min_c")
    trend = _trend(context, "t2m_mean_c")
    heat = _indicator(context, "heat_stress")
    frost = _indicator(context, "frost")

    lines = [
        f"Latest mean temperature: {_fmt(mean['value'] if mean else None, '°C')} "
        f"(maximum {_fmt(tmax['value'] if tmax else None, '°C')}, "
        f"minimum {_fmt(tmin['value'] if tmin else None, '°C')}).",
    ]
    if trend and trend["change"] is not None:
        lines.append(
            f"Over the last {trend['window_days']} days the mean changed "
            f"{trend['change']:+.1f} °C ({trend['direction']})."
        )
    if heat:
        lines += ["", f"Heat indicator: {heat['interpretation']}"]
    if frost:
        lines += ["", f"Frost indicator: {frost['interpretation']}"]
    return "\n".join(lines)


def _climate_answer(context: dict[str, Any], question: str) -> str:
    requested: list[tuple[str, str]] = []
    if "humidity" in question:
        requested.append(("rh_mean_pct", "Relative humidity"))
    if "wind" in question:
        requested.append(("wind_speed_2m_ms", "Wind speed"))
    if "solar" in question or "radiation" in question:
        requested.append(("solar_radiation_mj_m2_day", "Solar radiation"))
    if "pressure" in question:
        requested.append(("pressure_kpa", "Surface pressure"))
    if not requested:
        requested = [
            ("rh_mean_pct", "Relative humidity"),
            ("wind_speed_2m_ms", "Wind speed"),
            ("solar_radiation_mj_m2_day", "Solar radiation"),
        ]

    lines: list[str] = []
    for variable, label in requested:
        row = _latest(context, variable)
        trend = _trend(context, variable)
        line = f"{label}: {_fmt(row['value'] if row else None, row['unit'] if row else None)}"
        if row and row.get("date"):
            line += f" on {row['date']}"
        if trend and trend["change"] is not None:
            line += f"; {trend['direction']} over the last {trend['window_days']} days"
        lines.append(line + ".")
    lines.append("These are NASA POWER reanalysis values for a coarse grid cell, not on-farm sensors.")
    return "\n".join(lines)


def _confidence_answer(context: dict[str, Any]) -> str:
    irrigation = context["irrigation"]
    env = context["environment"]
    lines = [
        f"Irrigation confidence: {irrigation['confidence']['level'].upper()}.",
        _bullets(irrigation["confidence"]["reasons"]),
        "",
        f"Environment data coverage: {env['coverage_fraction'] * 100:.0f}% of days "
        f"in the analysis window.",
    ]
    if env["missing_variables"]:
        lines.append("Variables without complete data: " + ", ".join(env["missing_variables"]) + ".")
    lines += ["", "Key limitation: " + context["limitations"][0]] if context["limitations"] else []
    return "\n".join(lines)


def _et_answer(context: dict[str, Any]) -> str:
    irrigation = context["irrigation"]
    stage = irrigation["growth_stage"] or {}
    lines = [
        "The platform computes reference evapotranspiration (ET₀) with the FAO-56 "
        "Penman–Monteith equation using daily NASA POWER temperature, humidity, wind and "
        "solar radiation. Crop water use is then ETc = Kc × ET₀.",
        "",
        f"Latest ET₀: {_fmt(irrigation['et0_mm_per_day'], 'mm/day', 2)}.",
        f"Current Kc: {_fmt(irrigation['crop_coefficient_kc'], None, 2)} "
        f"({stage.get('name', 'stage unavailable')}).",
        f"Current ETc: {_fmt(irrigation['etc_mm_per_day'], 'mm/day', 2)}.",
    ]
    if irrigation["net_refill_requirement_mm"] is not None:
        lines.append(
            f"Root-zone refill estimate: {_fmt(irrigation['net_refill_requirement_mm'], 'mm', 1)} net."
        )
    lines += [
        "",
        "ET₀ is a calculated atmospheric demand, not a measured water loss from this field.",
    ]
    return "\n".join(lines)


def _missing_answer(context: dict[str, Any]) -> str:
    missing: list[str] = []
    missing.extend(context["environment"]["missing_variables"])
    missing.extend(context["irrigation"]["missing_inputs"])
    missing.extend(context["crop_health"]["missing_inputs"])
    if not context["vegetation"]["available"] and not any(
        item.startswith("Vegetation index (NDVI)") for item in missing
    ):
        missing.append("Vegetation index (NDVI): " + (context["vegetation"]["reason"] or "unavailable"))

    unique = list(dict.fromkeys(missing))
    if not unique:
        return "All inputs required for the current analyses are present. No variable is flagged as missing."
    return "Data currently unavailable or incomplete:\n" + _bullets(unique[:10])


def _summary_answer(context: dict[str, Any]) -> str:
    field = context["field"]
    irrigation = context["irrigation"]
    health = context["crop_health"]
    env = context["environment"]
    mean = _latest(context, "t2m_mean_c")

    lines = [
        f"{field['name']} — {field['crop']}, planted {field['planting_date']}. "
        f"Analysis date {field['analysis_date']}.",
        "",
        f"Irrigation demand: {irrigation['demand_label']} "
        f"(confidence {irrigation['confidence']['level'].upper()}).",
        f"Crop health: {health['status'].replace('_', ' ').upper()}.",
        f"Latest mean temperature: {_fmt(mean['value'] if mean else None, '°C')}; "
        f"rain in the last 7 days: {_fmt(env['recent_7_day_precipitation_mm'], 'mm', 1)}.",
    ]
    if irrigation["status"] == "ok" and irrigation["demand_reasons"]:
        lines += ["", "Main driver: " + irrigation["demand_reasons"][0]]
    lines += [
        "",
        "You can ask about irrigation, rainfall, temperature, crop health, ET₀ or data confidence.",
    ]
    return "\n".join(lines)


def answer_question(question: str, context: dict[str, Any]) -> str:
    """Route a question to a fixed, data-grounded template."""
    lowered = question.lower().strip()

    if any(word in lowered for word in DEMAND_WORDS):
        return _irrigation_answer(context)
    if any(word in lowered for word in HEALTH_WORDS):
        return _health_answer(context, lowered)
    if any(word in lowered for word in RAIN_WORDS):
        return _rain_answer(context)
    if any(word in lowered for word in TEMPERATURE_WORDS):
        return _temperature_answer(context)
    if any(word in lowered for word in ET_WORDS):
        return _et_answer(context)
    if any(word in lowered for word in CONFIDENCE_WORDS):
        return _confidence_answer(context)
    if any(word in lowered for word in CLIMATE_WORDS):
        return _climate_answer(context, lowered)
    if any(word in lowered for word in MISSING_WORDS):
        return _missing_answer(context)
    return _summary_answer(context)
