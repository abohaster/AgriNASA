"""Robot soil-moisture history, plant images and water-requirement estimates."""

from types import SimpleNamespace

from app.crops import get_crop
from app.science.crop_coefficient import stage_for_day
from app.science.water_balance import get_soil_properties
from app.services.irrigation import _build_water_requirement, _stage_out

# 1x1 transparent PNG: a real image signature, 68 bytes decoded.
PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip"
    "1sAAAAASUVORK5CYII="
)


def _device_token(client, field_id: int) -> str:
    code = client.post("/api/devices/pairing-codes", json={"field_id": field_id}).json()["code"]
    claim = client.post("/api/devices/claim", json={"code": code, "label": "Evidence node"})
    assert claim.status_code == 201, claim.text
    return claim.json()["token"]


def test_moisture_endpoint_reports_unavailable_without_readings(client, field):
    body = client.get(f"/api/robot/fields/{field['id']}/moisture").json()
    assert body["status"] == "unavailable"
    assert body["latest_pct"] is None
    assert body["reading_count"] == 0
    assert body["points"] == []
    assert body["reason"]


def test_moisture_history_keeps_sensor_gps_and_status(client, field):
    token = _device_token(client, field["id"])
    posted = client.post(
        "/api/ingest/readings",
        json={
            "soil_moisture_pct": 26.5,
            "sensor_id": "soil-1",
            "latitude": 26.152,
            "longitude": 32.723,
            "status": "ok",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert posted.status_code == 201, posted.text

    history = client.get(f"/api/robot/fields/{field['id']}/moisture").json()
    assert history["status"] == "fresh"
    assert history["latest_pct"] == 26.5
    assert history["latest_sensor_id"] == "soil-1"
    assert history["measurement_status"] == "ok"
    assert history["reading_count"] == 1
    point = history["points"][0]
    assert point["sensor_id"] == "soil-1"
    assert point["status"] == "ok"
    assert point["latitude"] == 26.152
    assert point["longitude"] == 32.723
    assert point["measured_at"]


def test_image_upload_without_ai_key_stores_an_honest_unavailable_review(client, field):
    response = client.post(
        f"/api/robot/fields/{field['id']}/images",
        json={
            "image_base64": PNG_BASE64,
            "content_type": "image/png",
            "growth_stage": "vegetative_growth",
            "camera_id": "cam-1",
            "note": "Row 4",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["growth_stage"] == "vegetative_growth"
    assert body["camera_id"] == "cam-1"
    assert body["analysis"] is not None
    assert body["analysis"]["status"] == "unavailable"
    assert body["analysis"]["label"] is None
    assert body["analysis"]["confidence_pct"] is None

    listing = client.get(f"/api/robot/fields/{field['id']}/images").json()
    assert listing["crop_id"] == "wheat"
    assert listing["images"][0]["id"] == body["id"]
    assert listing["images"][0]["file_url"].endswith("/file")


def test_healthy_reference_upload_is_listed_for_the_crop(client, field):
    response = client.post(
        "/api/robot/references",
        json={
            "crop_id": "wheat",
            "label": "Healthy wheat, tillering",
            "image_base64": PNG_BASE64,
            "content_type": "image/png",
            "source_note": "Agronomist reference",
        },
    )
    assert response.status_code == 201, response.text

    listing = client.get(f"/api/robot/fields/{field['id']}/images").json()
    assert listing["healthy_reference_available"] is True
    assert any(ref["label"] == "Healthy wheat, tillering" for ref in listing["references"])


def test_water_requirement_uses_the_robot_probe_when_fresh():
    crop = get_crop("wheat")
    assert crop is not None
    stage = _stage_out(stage_for_day(crop, 40))
    probe = SimpleNamespace(latest_pct=20.0)
    field = SimpleNamespace(area_ha=2.5, irrigation_system="sprinkler", soil_texture="loam")

    result = _build_water_requirement(
        probe=probe,
        soil=get_soil_properties("loam"),
        crop=crop,
        stage=stage,
        field=field,
        robot_fresh=True,
        bucket_net_mm=None,
        bucket_gross_mm=None,
        bucket_confidence="low",
    )

    assert result.status == "estimated"
    assert result.label == "Estimated Water Requirement"
    assert result.method == "robot_soil_moisture"
    assert result.net_mm is not None and result.net_mm > 0
    assert result.gross_mm is not None and result.gross_mm >= result.net_mm
    assert result.volume_m3 is not None
    assert result.confidence in {"low", "medium"}
    assert result.assumptions


def test_water_requirement_falls_back_to_the_root_zone_balance():
    crop = get_crop("wheat")
    assert crop is not None
    stage = _stage_out(stage_for_day(crop, 40))
    field = SimpleNamespace(area_ha=2.5, irrigation_system="sprinkler")

    result = _build_water_requirement(
        probe=None,
        soil=get_soil_properties("loam"),
        crop=crop,
        stage=stage,
        field=field,
        robot_fresh=False,
        bucket_net_mm=15.0,
        bucket_gross_mm=20.0,
        bucket_confidence="medium",
    )

    assert result.status == "estimated"
    assert result.method == "root_zone_balance"
    assert result.net_mm == 15.0
    assert result.gross_mm == 20.0


def test_water_requirement_is_insufficient_without_evidence():
    crop = get_crop("wheat")
    assert crop is not None
    stage = _stage_out(stage_for_day(crop, 40))
    field = SimpleNamespace(area_ha=2.5, irrigation_system=None)

    result = _build_water_requirement(
        probe=None,
        soil=get_soil_properties("loam"),
        crop=crop,
        stage=stage,
        field=field,
        robot_fresh=False,
        bucket_net_mm=None,
        bucket_gross_mm=None,
        bucket_confidence="low",
    )

    assert result.status == "insufficient_data"
    assert result.method == "none"
    assert result.gross_mm is None
    assert "Insufficient data to estimate water requirement" in (result.reason or "")


def test_data_sources_catalogue_labels_robot_measurements(client):
    body = client.get("/api/data-sources").json()
    moisture = next(source for source in body["sources"] if source["id"] == "robot-soil-moisture")
    assert moisture["nature"] == "measured"
    assert "AgriNASA robot" in moisture["attribution"]
    assert moisture["url"] is None

    camera = next(source for source in body["sources"] if source["id"] == "robot-camera")
    assert camera["nature"] == "measured"
    assert any("point" in note.lower() for note in body["notes"])
