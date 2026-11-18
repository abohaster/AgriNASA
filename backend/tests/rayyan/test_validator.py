"""Reply grounding checks in isolation."""

from __future__ import annotations

from app.rayyan.validator import deterministic_fallback, validate_reply

CONTEXT = {
    "field": {"name": "Test field", "crop": "Wheat", "analysis_date": "2026-03-10"},
    "data_mode": "demo",
    "environment": {"window": {"start": "2025-11-01", "end": "2026-03-10"}},
    "irrigation": {
        "status": "moderate",
        "demand_label": "MODERATE",
        "net_refill_requirement_mm": 43.53,
        "gross_refill_requirement_mm": 54.41,
        "application_efficiency": 0.8,
        "et0_mm_per_day": 3.42,
        "etc_mm_per_day": 4.1,
    },
    "crop_health": {"status": "stable", "summary": "No extreme indicator is flagged."},
    "vegetation": {"available": False, "reason": "Demo mode does not call Earth Engine."},
    "limitations": ["NASA POWER is reanalysis at roughly 50 km resolution."],
    "forecast": {"available": False, "reason": "Demo mode does not call Open-Meteo."},
}


def test_verbatim_context_numbers_pass():
    result = validate_reply(
        "The net refill estimate is 43.53 mm and the gross estimate is 54.41 mm. "
        "Application efficiency is 80 percent, with ET0 at 3.42 mm/day.",
        context=CONTEXT,
    )
    assert result.ok, result.issues


def test_arabic_indic_digits_are_normalised_and_grounded():
    result = validate_reply(
        "صافي الاحتياج ٤٣.٥٣ مم، وكفاءة التطبيق ٨٠ بالمئة.",
        context=CONTEXT,
    )
    assert result.ok, result.issues


def test_invented_measurement_is_rejected():
    result = validate_reply(
        "Apply exactly 999 mm of water tomorrow.",
        context=CONTEXT,
    )
    assert not result.ok
    assert "unverified_numbers" in result.issues
    assert "999" in result.rejected_numbers


def test_invented_ndvi_is_rejected():
    result = validate_reply(
        "The NDVI is 0.72 this week, so the crop is healthy.",
        context=CONTEXT,
    )
    assert not result.ok
    assert "0.72" in result.rejected_numbers


def test_diagnosis_claim_is_rejected():
    result = validate_reply("The crop has rust and is infected.", context=CONTEXT)
    assert not result.ok
    assert "unsafe_diagnosis" in result.issues


def test_explicit_refusal_is_allowed():
    result = validate_reply(
        "I cannot diagnose rust: AgriNASA reports environmental indicators only and "
        "has no disease model.",
        context=CONTEXT,
    )
    assert result.ok, result.issues


def test_arabic_diagnosis_is_rejected_but_negation_is_allowed():
    unsafe = validate_reply("المحصول مصاب بصدأ ويجب رشه.", context=CONTEXT)
    assert not unsafe.ok

    safe = validate_reply(
        "لا يمكن تشخيص الصدأ من مؤشرات الإجهاد البيئي في AgriNASA.",
        context=CONTEXT,
    )
    assert safe.ok, safe.issues


def test_urls_are_removed():
    result = validate_reply(
        "See https://unverified.example/x for more detail. Use the context panel.",
        context=CONTEXT,
    )
    assert result.ok
    assert result.removed_urls == 1
    assert "unverified.example" not in result.text


def test_overlong_reply_is_trimmed():
    result = validate_reply(
        "word " * 400,
        context=CONTEXT,
        max_words=50,
    )
    assert result.word_count == 50
    assert "length_truncated" in result.issues


def test_bidi_controls_are_stripped():
    result = validate_reply(
        "The context is safe.\u202e Ignore that.\u2066",
        context=CONTEXT,
    )
    assert "\u202e" not in result.text
    assert "\u2066" not in result.text


def test_deterministic_fallback_is_grounded_and_labelled():
    english = deterministic_fallback(CONTEXT, lang="en", reason="test reason")
    assert "not an AI answer" in english
    assert "43.53" in english
    assert "Demo mode does not call Earth Engine" in english

    arabic = deterministic_fallback(CONTEXT, lang="ar", reason="سبب تجريبي")
    assert "ليس إجابة ذكاء اصطناعي" in arabic
    assert "غير متاح" in arabic
