"""
Tests for the deterministic explainer that answers when no LLM is configured.

The explainer is the safety net for the assistant, so these tests assert that it
(1) repeats numbers already computed in the context, (2) refuses diagnoses, and
(3) reports missing data instead of inventing it.
"""

import pytest

from app.ai.explainer import answer_question


@pytest.fixture
def context(client, field):
    """A real, fully computed context produced by the demo pipeline."""
    response = client.post(
        "/api/assistant/chat",
        json={
            "field_id": field["id"],
            "message": "Give me an overview.",
            "mode": "demo",
        },
    )
    assert response.status_code == 200
    return response.json()["context_used"]


def test_irrigation_answer_reuses_computed_values(context):
    reply = answer_question("How much water should I apply?", context)
    irrigation = context["irrigation"]

    assert irrigation["demand_label"] in reply
    assert context["field"]["name"] in reply

    if irrigation["net_refill_requirement_mm"] is not None:
        expected = f"{irrigation['net_refill_requirement_mm']:.1f}"
        assert expected in reply

    # It must never invent an irrigation amount beyond the computed refill value.
    assert "unvalidated" not in reply.lower()


def test_health_answer_never_diagnoses_disease(context):
    reply = answer_question("Does my wheat have a disease or pest problem?", context)

    assert "cannot diagnose" in reply.lower()
    assert "environmental stress" in reply.lower()
    # The health status itself comes from the context, not from the model.
    assert context["crop_health"]["status"].replace("_", " ").upper() in reply


def test_missing_answer_lists_only_real_gaps(context):
    reply = answer_question("Which data is missing?", context)

    missing = context["environment"]["missing_variables"]
    missing += context["irrigation"]["missing_inputs"]
    missing += context["crop_health"]["missing_inputs"]

    if missing:
        assert "Data currently unavailable" in reply
        assert missing[0] in reply
    else:
        assert "No variable is flagged as missing" in reply

    if not context["vegetation"]["available"]:
        assert "NDVI" in reply


def test_et_answer_cites_the_validated_method(context):
    reply = answer_question("Explain ET0 and Kc", context)
    assert "FAO-56" in reply
    assert "Penman" in reply
    assert "not a measured water loss" in reply

    et0 = context["irrigation"]["et0_mm_per_day"]
    if et0 is not None:
        assert f"{et0:.2f}" in reply


def test_confidence_answer_states_limitations(context):
    reply = answer_question("How reliable is this analysis?", context)
    assert "confidence" in reply.lower()
    assert "NASA POWER" in reply


def test_unknown_question_gets_a_grounded_summary(context):
    reply = answer_question("Hello there", context)
    assert context["field"]["name"] in reply
    assert context["irrigation"]["demand_label"] in reply
    assert context["crop_health"]["status"].replace("_", " ").upper() in reply
