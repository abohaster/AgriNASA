"""Model eligibility, sequential probing, 600-second cache and API preservation."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.rayyan import keystore, model_health
from app.rayyan.gemini import GeminiCallError, GeminiClient, directory
from app.rayyan.model_health import (
    CONTINUE_CODES,
    VerifiedModelCache,
    find_working_model,
    is_eligible_model,
    probe_model,
    ranked_candidates,
    verified_models,
)
from tests.rayyan.conftest import ADMIN_HEADERS, ALPHA, BETA, create_key

FLASH = "gemini-3.5-flash"
FLASH_NEW = "gemini-3.6-flash"
FLASH_LITE = "gemini-3.5-flash-lite"


class ScriptedClient:
    def __init__(self, outcomes: dict[str, str] | None = None) -> None:
        self.outcomes = outcomes or {}
        self.calls: list[str] = []

    async def probe_generate(
        self,
        *,
        model: str,
        timeout: float,
        system: str,
        user: str,
        max_output_tokens: int,
    ):
        self.calls.append(model)
        outcome = self.outcomes.get(model, "ok")
        if outcome == "ok":
            await asyncio.sleep(0)
            return SimpleNamespace(text="OK")
        if outcome == "empty":
            return SimpleNamespace(text="   ")
        codes = {
            "quota": ("GEMINI_QUOTA_EXCEEDED", "quota exhausted", "30s"),
            "invalid": ("GEMINI_KEY_INVALID", "API key not valid", None),
            "timeout": ("GEMINI_TIMEOUT", "read timed out", None),
            "connect_timeout": ("GEMINI_CONNECT_TIMEOUT", "connect timed out", None),
            "network": ("GEMINI_UNREACHABLE", "network failure", None),
            "server": ("GEMINI_UNAVAILABLE", "server unavailable", None),
            "overloaded": (
                "GEMINI_MODEL_OVERLOADED",
                "this model is over capacity",
                None,
            ),
            "unknown": ("GEMINI_SOMETHING_NEW", "unclassified", None),
            "not_found": ("GEMINI_MODEL_NOT_FOUND", "model not found", None),
        }
        code, message, retry = codes[outcome]
        raise GeminiCallError(code, message, retry_after=retry)


def _run(coro):
    return asyncio.run(coro)


def _ask(client: TestClient, field_id: int, message: str = "Explain the irrigation status."):
    return client.post(
        "/api/rayyan/ask", json={"field_id": field_id, "message": message}
    )


def _key(client: TestClient, key_id: str) -> dict:
    listing = client.get("/api/rayyan/settings", headers=ADMIN_HEADERS).json()
    return next(entry for entry in listing["keys"] if entry["id"] == key_id)


# ── eligibility and ordering ─────────────────────────────────────────────


@pytest.mark.parametrize(
    "model",
    [
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-preview-05-20",
        "models/gemini-2.5-flash",
    ],
)
def test_eligibility_accepts_flash_and_flash_lite_text_models(model: str):
    assert is_eligible_model(model) is True


@pytest.mark.parametrize(
    "model",
    [
        "gemini-2.5-pro",
        "gemini-pro-latest",
        "gemini-2.5-flash-image",
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-flash-native-audio",
        "gemini-2.5-flash-live",
        "text-embedding-004",
        "veo-3",
        "imagen-4",
    ],
)
def test_eligibility_rejects_pro_and_non_text_models(model: str):
    assert is_eligible_model(model) is False


def test_ranking_keeps_saved_model_first_and_only_eligible_candidates():
    available = [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        FLASH,
        FLASH_NEW,
        FLASH_LITE,
        "gemini-flash-latest",
        "gemini-2.5-flash-preview-tts",
    ]
    assert ranked_candidates(available) == [
        FLASH_LITE,
        FLASH_NEW,
        FLASH,
        "gemini-2.5-flash",
        "gemini-flash-latest",
    ]
    assert ranked_candidates(available, "gemini-flash-latest")[0] == FLASH_LITE
    assert (
        ranked_candidates(available, "gemini-flash-latest", pin_preferred=True)[0]
        == "gemini-flash-latest"
    )
    assert ranked_candidates(available, "gemini-2.5-pro")[0] == FLASH_LITE


# ── sequential probing ───────────────────────────────────────────────────


def test_probes_sequentially_and_stops_at_first_success():
    client = ScriptedClient({FLASH: "not_found", FLASH_NEW: "ok"})
    model, probes = _run(
        find_working_model(
            client,
            [FLASH, FLASH_NEW],
            preferred=FLASH,
            limit=5,
        )
    )
    assert model == FLASH_NEW
    assert client.calls == [FLASH, FLASH_NEW]
    assert probes[-1].ok is True


@pytest.mark.parametrize(
    "failure",
    ["quota", "invalid", "timeout", "connect_timeout", "network", "server", "unknown", "empty"],
)
def test_unsafe_failures_stop_immediately(failure: str):
    client = ScriptedClient({FLASH: failure, FLASH_NEW: "ok"})
    model, probes = _run(
        find_working_model(client, [FLASH, FLASH_NEW], preferred=FLASH, limit=5)
    )
    assert model is None
    assert client.calls == [FLASH]
    assert probes[-1].code not in CONTINUE_CODES


def test_only_a_model_specific_failure_may_continue():
    client = ScriptedClient({FLASH: "not_found", FLASH_NEW: "ok"})
    model, probes = _run(
        find_working_model(client, [FLASH, FLASH_NEW], preferred=FLASH, limit=5)
    )
    assert model == FLASH_NEW
    assert [probe.code for probe in probes] == ["GEMINI_MODEL_NOT_FOUND", None]


def test_explicit_model_overload_continues_to_the_next_candidate():
    client = ScriptedClient({FLASH: "overloaded", FLASH_LITE: "ok"})
    model, probes = _run(
        find_working_model(client, [FLASH, FLASH_LITE], preferred=FLASH, limit=5)
    )
    assert model == FLASH_LITE
    assert client.calls == [FLASH, FLASH_LITE]
    assert probes[0].code == "GEMINI_MODEL_OVERLOADED"
    assert probes[-1].ok is True


def test_generic_503_is_not_treated_as_model_overload():
    client = ScriptedClient({FLASH: "server", FLASH_LITE: "ok"})
    model, probes = _run(
        find_working_model(client, [FLASH, FLASH_LITE], preferred=FLASH, limit=5)
    )
    assert model is None
    assert client.calls == [FLASH]
    assert probes[-1].code == "GEMINI_UNAVAILABLE"


def test_unversioned_alias_is_not_probed_when_a_pinned_model_is_available():
    alias = "gemini-flash-latest"
    client = ScriptedClient({FLASH_LITE: "ok"})
    model, probes = _run(
        find_working_model(client, [alias, FLASH_LITE], preferred=alias, limit=5)
    )
    assert model == FLASH_LITE
    assert client.calls == [FLASH_LITE]
    assert [probe.model for probe in probes] == [FLASH_LITE]


def test_explicitly_pinned_alias_is_probed_first():
    alias = "gemini-flash-latest"
    client = ScriptedClient({alias: "ok", FLASH_LITE: "ok"})
    model, _ = _run(
        find_working_model(
            client, [alias, FLASH_LITE], preferred=alias, limit=5, pin_preferred=True
        )
    )
    assert model == alias
    assert client.calls == [alias]


def test_no_unverified_fallback_when_every_candidate_fails():
    client = ScriptedClient({FLASH: "not_found", FLASH_NEW: "not_found", FLASH_LITE: "not_found"})
    model, probes = _run(
        find_working_model(
            client, [FLASH, FLASH_NEW, FLASH_LITE], preferred=FLASH, limit=5
        )
    )
    assert model is None
    assert client.calls == [FLASH, FLASH_LITE, FLASH_NEW]
    assert len(probes) == 3


def test_probe_total_deadline_is_classified_as_timeout(monkeypatch):
    async def fake_wait_for(awaitable, timeout):
        awaitable.close()
        raise asyncio.TimeoutError

    monkeypatch.setattr(model_health.asyncio, "wait_for", fake_wait_for)
    probe = _run(probe_model(ScriptedClient(), FLASH, timeout=0.01))
    assert probe.ok is False
    assert probe.code == "GEMINI_TIMEOUT"


def test_probe_generate_uses_production_generate_and_connect_timeout(monkeypatch):
    seen: dict[str, object] = {}

    async def fake_generate(self, **kwargs):
        seen.update(kwargs)
        seen["connect_timeout"] = self._connect_timeout
        seen["timeout"] = self._timeout
        return SimpleNamespace(text="OK")

    monkeypatch.setattr(GeminiClient, "generate", fake_generate)
    client = GeminiClient("AIza-synthetic-probe-only", connect_timeout=7)
    result = _run(
        client.probe_generate(
            model=FLASH,
            timeout=3,
            system="probe system",
            user="probe user",
            max_output_tokens=12,
        )
    )
    assert result.text == "OK"
    assert seen == {
        "model": FLASH,
        "system": "probe system",
        "user": "probe user",
        "max_output_tokens": 12,
        "connect_timeout": 7,
        "timeout": 3,
    }


# ── cache correctness ────────────────────────────────────────────────────


def test_cache_ttl_is_exactly_600_seconds(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(model_health.time, "monotonic", lambda: clock[0])
    cache = VerifiedModelCache()
    cache.put("key-1", "secret-a", FLASH)

    clock[0] += 599.0
    assert cache.get("key-1", "secret-a", FLASH) == FLASH

    clock[0] += 1.0
    assert cache.get("key-1", "secret-a", FLASH) is None


def test_cache_is_scoped_to_credential_selected_model_and_key_id(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(model_health.time, "monotonic", lambda: clock[0])
    cache = VerifiedModelCache()
    cache.put("key-1", "secret-a", FLASH)

    assert cache.get("key-1", "secret-b", FLASH) is None
    assert cache.get("key-1", "secret-a", FLASH_NEW) is None
    assert cache.get("key-2", "secret-a", FLASH) is None


def test_cache_invalidation_drops_entries_and_all_entries():
    cache = VerifiedModelCache()
    cache.put("key-1", "secret-a", FLASH)
    cache.invalidate("key-1")
    assert cache.get("key-1", "secret-a", FLASH) is None

    cache.put("key-1", "secret-a", FLASH)
    cache.put("key-2", "secret-b", FLASH)
    cache.invalidate_all()
    assert cache.get("key-1", "secret-a", FLASH) is None
    assert cache.get("key-2", "secret-b", FLASH) is None


def test_expired_cache_never_bypasses_verification(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(model_health.time, "monotonic", lambda: clock[0])
    cache = VerifiedModelCache()
    cache.put("key-1", "secret-a", FLASH)
    clock[0] += 600.0

    client = ScriptedClient({FLASH: "ok"})
    result = _run(
        cache.verify(client, "key-1", "secret-a", [FLASH], preferred=FLASH)
    )
    assert client.calls == [FLASH]
    assert result.model == FLASH
    assert result.cache_hit is False


def test_concurrent_requests_share_one_verification_probe():
    class SlowClient(ScriptedClient):
        async def probe_generate(self, **kwargs):
            self.calls.append(kwargs["model"])
            await asyncio.sleep(0.05)
            return SimpleNamespace(text="OK")

    cache = VerifiedModelCache()
    client = SlowClient()

    async def scenario():
        return await asyncio.gather(
            cache.verify(client, "key-1", "secret-a", [FLASH], preferred=FLASH),
            cache.verify(client, "key-1", "secret-a", [FLASH], preferred=FLASH),
        )

    first, second = _run(scenario())
    assert client.calls == [FLASH]
    assert first.model == second.model == FLASH


def test_cache_does_not_store_the_raw_api_key():
    cache = VerifiedModelCache()
    cache.put("key-1", "AIza-sensitive-value", FLASH)
    assert "AIza-sensitive-value" not in repr(cache._entries)


# ── production flow and preservation ─────────────────────────────────────


def test_warm_cache_avoids_reverification_per_chat(rayyan_client, field, fake):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    fake.requests.clear()

    first = _ask(rayyan_client, field["id"])
    assert first.status_code == 200, first.text
    assert first.json()["model"] == created["model"]
    assert len(fake.generated) == 1

    fake.requests.clear()
    second = _ask(rayyan_client, field["id"], "Explain the crop-health status.")
    assert second.status_code == 200, second.text
    assert len(fake.generated) == 1
    assert not any(request.url.path.endswith("/models") for request in fake.requests)


def test_verification_timeout_returns_error_and_preserves_key(rayyan_client, field, fake):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    fake.model_modes[created["model"]] = "timeout"
    verified_models.clear()
    fake.requests.clear()

    response = _ask(rayyan_client, field["id"])
    assert response.status_code == 504, response.text
    error = response.json()["error"]
    assert error["code"] == "GEMINI_TIMEOUT"
    assert "not changed" in error["details"].lower()
    assert ALPHA not in response.text
    assert len(fake.generated) == 1, "a timeout must stop before trying another model"

    key = _key(rayyan_client, created["id"])
    assert key["status"] == "valid"
    assert key["model"] == created["model"]
    assert rayyan_client.get("/api/rayyan/availability").json()["configured"] is True


def test_quota_during_verification_stops_without_trying_other_models(
    rayyan_client, field, fake
):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    fake.model_modes[created["model"]] = "quota"
    verified_models.clear()
    fake.requests.clear()

    response = _ask(rayyan_client, field["id"])
    assert response.status_code == 429, response.text
    error = response.json()["error"]
    assert error["code"] == "GEMINI_QUOTA_EXCEEDED"
    assert "another valid saved key" in error["details"]
    assert "30s" in error["details"]
    assert len(fake.generated) == 1

    key = _key(rayyan_client, created["id"])
    assert key["status"] == "quota_limited"
    assert key["model"] == created["model"]
    assert key["last_error_code"] == "GEMINI_QUOTA_EXCEEDED"


def test_model_specific_404_continues_and_reaches_frontend(
    rayyan_client, field, fake
):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    broken = created["model"]
    fallback = "gemini-2.5-flash" if broken != "gemini-2.5-flash" else FLASH
    fake.model_modes[broken] = "not_found"
    verified_models.clear()

    response = _ask(rayyan_client, field["id"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["model"] == fallback
    assert "instead of the saved model" in body["notice"]

    generated = json.loads(fake.generated[-1].content.decode("utf-8"))
    assert generated["model"] == body["model"]
    assert _key(rayyan_client, created["id"])["model"] == fallback


def test_model_overload_switches_to_flash_lite_and_persists_it(
    rayyan_client, field, fake
):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    saved = created["model"]
    directory.put(created["id"], [saved, FLASH_LITE, FLASH_NEW])
    fake.model_modes[saved] = "overloaded"
    verified_models.clear()
    fake.requests.clear()

    response = _ask(rayyan_client, field["id"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["model"] == FLASH_LITE
    assert "instead of the saved model" in body["notice"]
    assert [fake._requested_model(r) for r in fake.generated] == [
        saved,
        FLASH_LITE,
        FLASH_LITE,
    ]

    key = _key(rayyan_client, created["id"])
    assert key["status"] == "valid"
    assert key["model"] == FLASH_LITE
    assert verified_models.get(created["id"], ALPHA, FLASH_LITE) == FLASH_LITE


def test_generic_503_does_not_try_flash_lite_and_preserves_the_key(
    rayyan_client, field, fake
):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    saved = created["model"]
    directory.put(created["id"], [saved, FLASH_LITE])
    fake.model_modes[saved] = "server"
    verified_models.clear()
    fake.requests.clear()

    response = _ask(rayyan_client, field["id"])
    assert response.status_code == 502, response.text
    assert response.json()["error"]["code"] == "GEMINI_UNAVAILABLE"
    assert len(fake.generated) == 1, "a generic 5xx must stop before another model"

    key = _key(rayyan_client, created["id"])
    assert key["status"] == "valid"
    assert key["model"] == saved


def test_all_models_overloaded_returns_actionable_error_and_preserves_the_key(
    rayyan_client, field, fake
):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    saved = created["model"]
    directory.put(created["id"], [saved, FLASH_LITE])
    fake.model_modes[saved] = "overloaded"
    fake.model_modes[FLASH_LITE] = "overloaded"
    verified_models.clear()
    fake.requests.clear()

    response = _ask(rayyan_client, field["id"])
    assert response.status_code == 502, response.text
    assert "capacity" in response.json()["error"]["details"].lower()
    assert len(fake.generated) == 2

    key = _key(rayyan_client, created["id"])
    assert key["status"] == "valid"
    assert key["model"] == saved
    assert verified_models.size() == 0


def test_generation_overload_returns_labelled_fallback_without_retry(
    rayyan_client, field, fake
):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    saved = created["model"]
    fake.model_modes[saved] = "overloaded"
    fake.requests.clear()

    response = _ask(rayyan_client, field["id"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "deterministic_fallback"
    assert body["provider_error"]["code"] == "GEMINI_MODEL_OVERLOADED"
    assert len(fake.generated) == 1, "no automatic retry after a 5xx"
    assert verified_models.get(created["id"], ALPHA, saved) is None

    key = _key(rayyan_client, created["id"])
    assert key["status"] == "valid"
    assert key["model"] == saved


def test_saved_latest_alias_is_skipped_for_a_pinned_lite_model(
    rayyan_client, field, fake
):
    created = create_key(
        rayyan_client, label="Alias", api_key=ALPHA, model="gemini-flash-latest"
    ).json()
    assert created["model"] == "gemini-flash-latest"
    directory.put(created["id"], ["gemini-flash-latest", FLASH_LITE])
    fake.model_modes["gemini-flash-latest"] = "timeout"
    verified_models.clear()
    fake.requests.clear()

    response = _ask(rayyan_client, field["id"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["model"] == FLASH_LITE
    assert "unversioned alias" in body["notice"]
    assert [fake._requested_model(r) for r in fake.generated] == [FLASH_LITE, FLASH_LITE]

    key = _key(rayyan_client, created["id"])
    assert key["status"] == "valid"
    assert key["model"] == FLASH_LITE
    assert verified_models.get(created["id"], ALPHA, FLASH_LITE) == FLASH_LITE


def test_validate_repairs_the_saved_model_after_a_404(rayyan_client, fake):
    created = create_key(
        rayyan_client, label="Primary", api_key=ALPHA, model=FLASH
    ).json()
    fake.model_modes[FLASH] = "not_found"

    response = rayyan_client.post(
        f"/api/rayyan/settings/keys/{created['id']}/validate",
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["valid"] is True
    assert body["model"] == "gemini-2.5-flash"
    assert "selected instead" in body["message"]

    key = _key(rayyan_client, created["id"])
    assert key["status"] == "valid"
    assert key["model"] == body["model"]


def test_ineligible_model_cannot_be_selected(rayyan_client, fake):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    before = len(fake.generated)

    response = rayyan_client.patch(
        f"/api/rayyan/settings/keys/{created['id']}",
        headers=ADMIN_HEADERS,
        json={"model": "gemini-2.5-pro"},
    )
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "GEMINI_MODEL_UNSUPPORTED"
    assert len(fake.generated) == before
    assert _key(rayyan_client, created["id"])["model"] == created["model"]


def test_manual_model_change_requires_verification_and_preserves_previous(
    rayyan_client, fake
):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    target = "gemini-2.5-flash" if created["model"] != "gemini-2.5-flash" else FLASH
    fake.model_modes[target] = "timeout"

    response = rayyan_client.patch(
        f"/api/rayyan/settings/keys/{created['id']}",
        headers=ADMIN_HEADERS,
        json={"model": target},
    )
    assert response.status_code == 504, response.text
    assert response.json()["error"]["code"] == "GEMINI_TIMEOUT"
    assert _key(rayyan_client, created["id"])["model"] == created["model"]


def test_failed_activation_preserves_the_current_active_key(rayyan_client, fake):
    first = create_key(rayyan_client, label="First", api_key=ALPHA).json()
    second = create_key(rayyan_client, label="Second", api_key=BETA).json()
    fake.model_modes[second["model"]] = "timeout"

    response = rayyan_client.post(
        f"/api/rayyan/settings/keys/{second['id']}/activate",
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 504, response.text

    with SessionLocal() as session:
        rows = keystore.list_keys(session)
    assert len(rows) == 2
    active = next(row for row in rows if row["active"])
    assert active["id"] == first["id"]
    assert active["model"] == first["model"]


def test_activation_invalidates_the_previous_active_verification(rayyan_client, fake):
    first = create_key(rayyan_client, label="First", api_key=ALPHA).json()
    second = create_key(rayyan_client, label="Second", api_key=BETA).json()
    assert verified_models.get(first["id"], ALPHA, first["model"]) == first["model"]

    response = rayyan_client.post(
        f"/api/rayyan/settings/keys/{second['id']}/activate",
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 200, response.text
    assert verified_models.get(first["id"], ALPHA, first["model"]) is None
    assert verified_models.get(second["id"], BETA, second["model"]) == second["model"]


def test_model_change_removes_the_old_cached_verification(rayyan_client, fake):
    created = create_key(
        rayyan_client, label="Primary", api_key=ALPHA, model=FLASH
    ).json()
    assert verified_models.get(created["id"], ALPHA, FLASH) == FLASH

    response = rayyan_client.patch(
        f"/api/rayyan/settings/keys/{created['id']}",
        headers=ADMIN_HEADERS,
        json={"model": "gemini-2.5-flash"},
    )
    assert response.status_code == 200, response.text
    assert verified_models.get(created["id"], ALPHA, FLASH) is None
    assert (
        verified_models.get(created["id"], ALPHA, "gemini-2.5-flash")
        == "gemini-2.5-flash"
    )


def test_delete_removes_the_cached_verification(rayyan_client, field):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()
    assert verified_models.get(created["id"], ALPHA, created["model"]) == created["model"]

    response = rayyan_client.delete(
        f"/api/rayyan/settings/keys/{created['id']}", headers=ADMIN_HEADERS
    )
    assert response.status_code == 204
    assert verified_models.get(created["id"], ALPHA, created["model"]) is None

    blocked = _ask(rayyan_client, field["id"])
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "RAYAN_NO_ACTIVE_KEY"
