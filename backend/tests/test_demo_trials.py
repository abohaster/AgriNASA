"""Demo-trial endpoints used by every field-scoped tool.

These tests never call external services: they only check that the real
locations are exposed and materialised as clearly labelled fields, idempotently.
"""

from datetime import date, timedelta

TRIAL_KEYS = [
    "delta_irrigated",
    "nubaria_reclamation",
    "sharqia_prepared",
    "luxor_tomato",
]


def test_demo_trials_list_the_real_locations(client):
    response = client.get("/api/demo-trials")
    assert response.status_code == 200

    trials = response.json()
    assert [trial["key"] for trial in trials] == TRIAL_KEYS
    for trial in trials:
        ring = trial["geometry"]["coordinates"][0]
        assert trial["geometry"]["type"] == "Polygon"
        assert ring[0] == ring[-1]
        assert -90 <= trial["latitude"] <= 90
        assert -180 <= trial["longitude"] <= 180
        assert trial["name_ar"] and trial["description_ar"]
        assert trial["planting_offset_days"] >= 0

    # Listing metadata must not create fields.
    assert client.get("/api/fields").json() == []


def test_trials_cover_every_registered_crop(client):
    from app.crops import list_crops

    trial_crops = {trial["crop_id"] for trial in client.get("/api/demo-trials").json()}
    assert trial_crops == {crop.id for crop in list_crops()}


def test_unknown_trial_key_is_rejected(client):
    response = client.post("/api/demo-trials/not_a_trial")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_every_trial_uses_a_registered_crop(client):
    from app.crops import get_crop

    for trial in client.get("/api/demo-trials").json():
        assert get_crop(trial["crop_id"]) is not None, trial["key"]


def test_materialising_a_trial_is_idempotent_and_labelled(client):
    first = client.post("/api/demo-trials/delta_irrigated")
    assert first.status_code == 200
    field = first.json()
    try:
        assert field["name"] == "Demo trial · Nile Delta irrigated field"
        assert field["crop_id"] == "wheat"
        assert field["location_label"] == "Nile Delta irrigated field"
        assert field["boundary_geojson"]["type"] == "Polygon"
        assert field["planting_date"] == (
            date.today() - timedelta(days=7)
        ).isoformat()

        again = client.post("/api/demo-trials/delta_irrigated")
        assert again.status_code == 200
        assert again.json()["id"] == field["id"]

        stored = client.get(f"/api/fields/{field['id']}").json()
        assert stored["boundary_geojson"] == field["boundary_geojson"]
    finally:
        client.delete(f"/api/fields/{field['id']}")


def test_a_trial_refreshes_its_profile(client):
    created = client.post("/api/demo-trials/sharqia_prepared").json()
    try:
        patched = client.patch(
            f"/api/fields/{created['id']}",
            json={"planting_date": "2025-01-01", "soil_texture": "sand"},
        )
        assert patched.status_code == 200

        refreshed = client.post("/api/demo-trials/sharqia_prepared").json()
        assert refreshed["id"] == created["id"]
        assert refreshed["planting_date"] == (
            date.today() - timedelta(days=2)
        ).isoformat()
        assert refreshed["soil_texture"] == "clay_loam"
    finally:
        client.delete(f"/api/fields/{created['id']}")


def test_potato_and_tomato_trials_materialise_with_their_crop(client):
    for key, crop_id in (
        ("nubaria_reclamation", "potato"),
        ("luxor_tomato", "tomato"),
    ):
        field = client.post(f"/api/demo-trials/{key}").json()
        try:
            assert field["crop_id"] == crop_id
            assert field["name"].startswith("Demo trial · ")
        finally:
            client.delete(f"/api/fields/{field['id']}")
