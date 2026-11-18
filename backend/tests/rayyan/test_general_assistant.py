"""RAYAN as a general agricultural assistant: mocked Gemini only."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.rayyan.prompts import SYSTEM_PROMPT
from app.rayyan.validator import validate_reply
from tests.rayyan.conftest import ALPHA, create_key

BEE_REPLY = (
    "Bees are beneficial pollinators, not automatically pests, so the first step is "
    "not to destroy the colony. Keep children, workers and animals away from the "
    "area, and do not disturb, handle, burn or spray the hive. Contact an experienced "
    "local beekeeper to assess the situation and, if needed, relocate the colony. "
    "Is this a temporary swarm, or are the bees building comb? Where are they "
    "gathering? If anyone is allergic or the colony is aggressive, keep a safe "
    "distance and call a professional. Do not use pesticides on the colony."
)

BEE_REPLY_AR = (
    "النحل ملقّح مفيد للمحصول، ومش لازم تعامله كآفة من أول مرة. "
    "ابعد الأطفال والعمال والحيوانات عن مكان النحل، ومتلمسش الخلية ومتحرقهاش ومترشهاش. "
    "اتصل بنحّال محلي عنده خبرة عشان يقيّم إذا كان ده سرب مؤقت ولا خلية مستقرة، ولو محتاج ينقلها. "
    "اسأله: النحل بيجمع فين؟ وهل بيبني شمع؟ "
    "لو حد عنده حساسية أو النحل عدواني، ابعد عن المكان واتصل بمتخصص. "
    "مترششيش مبيدات على الخلية."
)

DISEASE_REPLY = (
    "Yellow spots on tomato leaves can have several causes, including early blight, "
    "leaf-miner damage, nutrient stress or waterlogging. I cannot confirm a disease "
    "from a description alone. Please check whether the spots are small and circular "
    "with a dark border, whether they are mainly on older leaves, and whether the "
    "underside has mould or tiny insects? Also tell me roughly what share of the "
    "plants is affected and when the symptoms started? Remove badly affected leaves, "
    "avoid wetting the foliage, improve airflow and keep affected plants separate. "
    "For a confirmed identification and a safe treatment plan, show a sample to your "
    "local agricultural extension specialist."
)

INCOMPLETE_REPLY = (
    "Several things can make plants look poor, and I need a little more detail before "
    "narrowing it down. Which crop is it, and what exactly do you see: yellowing, "
    "stunted growth, spots or holes? When did it start, and is it on a few plants or "
    "most of the area? Check the soil moisture, look under the leaves for insects or "
    "mould, and show a clear photo or a sample to your local extension specialist. "
    "Do not spray a chemical until the problem and the product label are clear."
)

EARTHWORM_REPLY = (
    "Earthworms are beneficial: they break down organic matter, improve soil "
    "structure and create channels for air and water. Support them by adding compost, "
    "avoiding deep tillage and reducing harsh chemical use. If you tell me your soil "
    "type, I can suggest practical steps for your situation."
)


def _ask(client: TestClient, field_id: int, message: str, **extra):
    payload = {"field_id": field_id, "message": message, **extra}
    return client.post("/api/rayyan/ask", json=payload)


def _last_system_and_input(fake) -> tuple[str, str]:
    body = json.loads(fake.generated[-1].content.decode("utf-8"))
    return str(body["system_instruction"]), str(body["input"])


def _activate_key(client: TestClient) -> None:
    created = create_key(client, label="Primary", api_key=ALPHA)
    assert created.status_code in {200, 201}, created.text


def test_bees_question_gets_safe_practical_advice(rayyan_client: TestClient, field, fake):
    _activate_key(rayyan_client)
    fake.generate_text = BEE_REPLY

    response = _ask(
        rayyan_client,
        field["id"],
        "There are many bees in my farm and I am worried. What should I do?",
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["reply"] == BEE_REPLY
    assert body["validation"]["status"] == "passed"

    lowered = body["reply"].casefold()
    assert "pollinator" in lowered
    assert "beekeeper" in lowered
    assert "do not" in lowered
    assert "swarm" in lowered
    assert "?" in body["reply"]
    assert "unsafe_bee_action" not in body["validation"]["checks"]

    system, user = _last_system_and_input(fake)
    assert "general agricultural guidance" in system.casefold()
    assert "bees and other pollinators are beneficial" in system.casefold()
    assert "recommend burning" in system.casefold()
    assert "<computed_field_context>" in user
    assert '<question lang="en">' in user


def test_crop_disease_question_gets_guidance_and_follow_ups(
    rayyan_client: TestClient, field, fake
):
    _activate_key(rayyan_client)
    fake.generate_text = DISEASE_REPLY

    response = _ask(
        rayyan_client,
        field["id"],
        "My tomato leaves have yellow spots. What could it be?",
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["validation"]["status"] == "passed"
    assert "cannot confirm" in body["reply"].casefold()
    assert body["reply"].count("?") >= 2
    assert "extension specialist" in body["reply"].casefold()
    assert "apply" not in body["reply"].casefold()


def test_incomplete_description_is_not_rejected(rayyan_client: TestClient, field, fake):
    _activate_key(rayyan_client)
    fake.generate_text = INCOMPLETE_REPLY

    response = _ask(rayyan_client, field["id"], "My plants look bad, what is this?")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["validation"]["status"] == "passed"
    assert body["reply"].count("?") >= 2


def test_irrigation_question_uses_verified_field_context(
    rayyan_client: TestClient, field, fake
):
    _activate_key(rayyan_client)
    first = _ask(rayyan_client, field["id"], "Explain the irrigation status of this field.")
    assert first.status_code == 200, first.text
    net_refill = first.json()["context_used"]["irrigation"]["net_refill_requirement_mm"]
    assert net_refill is not None

    fake.generate_text = (
        f"In the field analysis, the net refill estimate is {net_refill} mm and it is "
        "decision support, not an applied volume. Check the soil moisture and the root "
        "zone before irrigating; if the topsoil is dry and the crop is at a sensitive "
        "stage, irrigate in the morning. The figure comes from coarse reanalysis, not "
        "from an on-farm measurement."
    )
    response = _ask(rayyan_client, field["id"], "Should I irrigate this field today?")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["validation"]["status"] == "passed"
    assert str(net_refill) in body["reply"]

    system, user = _last_system_and_input(fake)
    assert "Every figure or measurement you attribute to this field" in system
    assert "<computed_field_context>" in user
    assert "net_refill_requirement_mm" in user
    assert str(net_refill) in user


def test_general_question_does_not_force_field_data(
    rayyan_client: TestClient, field, fake
):
    _activate_key(rayyan_client)
    fake.generate_text = EARTHWORM_REPLY

    response = _ask(rayyan_client, field["id"], "What do earthworms do in the soil?")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["validation"]["status"] == "passed"
    lowered = body["reply"].casefold()
    for field_term in ("nasa power", "ndvi", "et0", "net refill", "irrigation status"):
        assert field_term not in lowered

    system, _ = _last_system_and_input(fake)
    assert "do not force" in system.casefold()


def test_unsafe_pesticide_advice_is_withheld(rayyan_client: TestClient, field, fake):
    _activate_key(rayyan_client)
    fake.generate_text = (
        "Mix 10 ml of insecticide per liter and spray the crop to kill the pest."
    )

    response = _ask(rayyan_client, field["id"], "How do I stop the insects on my crop?")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "deterministic_fallback"
    assert body["provider_error"]["code"] == "RAYAN_VALIDATION_REJECTED"
    assert body["validation"]["status"] == "rejected"
    assert "unsafe_pesticide" in body["validation"]["checks"]
    assert "10 ml" not in body["reply"]
    assert "insecticide" not in body["reply"].casefold()
    assert "net refill" not in body["reply"].casefold()


def test_burning_or_spraying_bees_is_withheld(rayyan_client: TestClient, field, fake):
    _activate_key(rayyan_client)
    fake.generate_text = (
        "Spray the hive with insecticide at 20 ml per liter to kill the bees."
    )

    response = _ask(rayyan_client, field["id"], "How do I get rid of the bees?")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "deterministic_fallback"
    assert body["provider_error"]["code"] == "RAYAN_VALIDATION_REJECTED"
    checks = body["validation"]["checks"]
    assert "unsafe_bee_action" in checks
    assert "unsafe_pesticide" in checks
    assert "20 ml" not in body["reply"]
    assert "insecticide" not in body["reply"].casefold()
    assert "withheld" in body["reply"].casefold()
    assert "net refill" not in body["reply"].casefold()


def test_egyptian_arabic_gets_egyptian_arabic_reply(
    rayyan_client: TestClient, field, fake
):
    _activate_key(rayyan_client)
    fake.generate_text = BEE_REPLY_AR

    response = _ask(
        rayyan_client,
        field["id"],
        "عندي نحل كتير في الأرض بيبني خلية، أعمل إيه؟",
        lang="ar",
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["reply"] == BEE_REPLY_AR
    assert body["validation"]["status"] == "passed"
    assert "النحل" in body["reply"]
    assert "متخصص" in body["reply"]
    assert "مترششيش" in body["reply"]

    system, user = _last_system_and_input(fake)
    assert "Egyptian Arabic" in system
    assert '<question lang="ar">' in user


def test_system_prompt_is_dual_mode_and_keeps_field_grounding():
    lowered = SYSTEM_PROMPT.casefold()
    assert "general agricultural guidance" in lowered
    assert "agrinasa field analysis" in lowered
    assert "use reliable general agronomic knowledge" in lowered
    assert "never refuse a general question" in lowered
    assert "must appear verbatim" in lowered
    assert "do not force" in lowered
    assert "never invent or recommend a pesticide" in lowered
    assert "bees and other pollinators are beneficial" in lowered
    assert "recommend burning" in lowered
    assert "Egyptian Arabic" in SYSTEM_PROMPT


def test_validator_allows_general_guidance_but_keeps_field_diagnosis_unsafe():
    context = {"field": {"crop": "Wheat"}, "irrigation": {"status": "moderate"}}
    general = validate_reply(
        "Aphids are small sap-sucking insects. Check your crop for them, keep 20 metres "
        "away from a bee swarm, and wait 3 days before inspecting again.",
        context=context,
    )
    assert general.ok, general.issues

    field_claim = validate_reply("Your crop has aphids on the leaves.", context=context)
    assert not field_claim.ok
    assert "unsafe_diagnosis" in field_claim.issues


def test_validator_keeps_verified_field_numbers_and_rejects_fabricated_ones():
    context = {"irrigation": {"net_refill_requirement_mm": 16.3}}
    verified = validate_reply(
        "The net refill estimate is 16.3 mm, which is decision support only.",
        context=context,
    )
    assert verified.ok, verified.issues

    fabricated = validate_reply(
        "The net refill estimate is 999 mm for this field.",
        context=context,
    )
    assert not fabricated.ok
    assert "999" in fabricated.rejected_numbers


def test_validator_blocks_pesticide_dose_but_allows_label_guidance():
    context = {"field": {"crop": "Wheat"}}
    unsafe = validate_reply(
        "Apply insecticide at 20 ml per liter on the crop.",
        context=context,
    )
    assert not unsafe.ok
    assert "unsafe_pesticide" in unsafe.issues

    safe = validate_reply(
        "Use an approved product only according to the label, with advice from a local "
        "extension specialist.",
        context=context,
    )
    assert safe.ok, safe.issues


def test_validator_does_not_treat_crop_rotation_as_a_diagnosis():
    context = {"field": {"crop": "Wheat"}}
    result = validate_reply(
        "Crop rotation is important for the field. Rotating cereals with legumes can "
        "break pest cycles and support soil health.",
        context=context,
    )
    assert result.ok, result.issues


def test_validator_allows_general_temperature_and_spacing_advice():
    context = {"field": {"crop": "Wheat"}}
    result = validate_reply(
        "Bees are most active above 15 °C. Space tomato plants 50 cm apart and keep "
        "20 metres away from a hive.",
        context=context,
    )
    assert result.ok, result.issues


def test_validator_blocks_a_field_unit_claim_without_a_context_anchor():
    context = {"field": {"crop": "Wheat"}}
    result = validate_reply("The crop has 999 mm of water.", context=context)
    assert not result.ok
    assert "999" in result.rejected_numbers


def test_validator_blocks_a_yield_prediction_about_the_field():
    context = {"field": {"crop": "Wheat"}}
    result = validate_reply("The field will yield five tons.", context=context)
    assert not result.ok
    assert "unsafe_diagnosis" in result.issues


def test_validator_allows_negated_bee_advice():
    context = {"field": {"crop": "Wheat"}}
    safe = validate_reply(
        "Do not burn or spray the hive. Keep people away and call a local beekeeper.",
        context=context,
    )
    assert safe.ok, safe.issues

    unsafe = validate_reply("Burn the hive before it spreads.", context=context)
    assert not unsafe.ok
    assert "unsafe_bee_action" in unsafe.issues
