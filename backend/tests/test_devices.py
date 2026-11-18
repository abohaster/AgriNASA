"""Field-robot pairing, device-key auth and sensor ingestion."""

from datetime import timedelta

from sqlalchemy import select

from app.db.database import SessionLocal
from app.db.models import PairingCode, RobotDevice, utcnow


def _pairing_code(client, field_id: int) -> dict:
    response = client.post("/api/devices/pairing-codes", json={"field_id": field_id})
    assert response.status_code == 201, response.text
    return response.json()


def _claim(client, code: str, label: str = "Test node") -> dict:
    response = client.post("/api/devices/claim", json={"code": code, "label": label})
    assert response.status_code == 201, response.text
    return response.json()


def _reading(token: str, **values) -> dict:
    return {
        "soil_moisture_pct": 23.5,
        "air_temp_c": 27.4,
        "humidity_pct": 48.0,
        "distance_cm": 112.0,
        **values,
    }


def test_pairing_code_is_single_use(client, field):
    payload = _pairing_code(client, field["id"])
    assert payload["field_id"] == field["id"]
    assert payload["field_name"] == field["name"]
    assert len(payload["code"]) == 8

    info = client.get(f"/api/devices/pairing-codes/{payload['code']}")
    assert info.status_code == 200
    assert info.json()["valid"] is True
    assert info.json()["field_id"] == field["id"]

    claimed = _claim(client, payload["code"])
    assert claimed["token"].startswith("ags_")
    assert claimed["field_name"] == field["name"]
    assert claimed["device"]["label"] == "Test node"
    assert "token" not in claimed["device"]

    again = client.post("/api/devices/claim", json={"code": payload["code"]})
    assert again.status_code == 410

    after = client.get(f"/api/devices/pairing-codes/{payload['code']}")
    assert after.status_code == 410


def test_expired_pairing_code_is_rejected(client, field):
    payload = _pairing_code(client, field["id"])
    with SessionLocal() as session:
        row = session.scalar(
            select(PairingCode).order_by(PairingCode.id.desc()).limit(1)
        )
        row.expires_at = utcnow() - timedelta(minutes=1)
        session.commit()

    assert client.get(f"/api/devices/pairing-codes/{payload['code']}").status_code == 410
    assert (
        client.post("/api/devices/claim", json={"code": payload["code"]}).status_code == 410
    )


def test_unknown_pairing_code_is_404(client):
    assert client.get("/api/devices/pairing-codes/ZZZZZZZZ").status_code == 404
    # Claim deliberately returns the same 410 for unknown, used and expired codes.
    assert client.post("/api/devices/claim", json={"code": "ZZZZZZZZ"}).status_code == 410


def test_pairing_code_requires_existing_field(client):
    response = client.post("/api/devices/pairing-codes", json={"field_id": 999_999})
    assert response.status_code == 404


def test_ingest_requires_a_valid_device_key(client, field):
    payload = _pairing_code(client, field["id"])
    token = _claim(client, payload["code"])["token"]

    missing = client.post("/api/ingest/readings", json=_reading(token))
    assert missing.status_code == 401

    wrong = client.post(
        "/api/ingest/readings",
        json=_reading(token),
        headers={"Authorization": "Bearer ags_not_a_real_key"},
    )
    assert wrong.status_code == 401

    accepted = client.post(
        "/api/ingest/readings",
        json=_reading(token),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert accepted.status_code == 201, accepted.text
    body = accepted.json()
    assert body["field_id"] == field["id"]
    assert body["soil_moisture_pct"] == 23.5
    assert body["measured_at"] is not None


def test_ingest_validates_values(client, field):
    payload = _pairing_code(client, field["id"])
    token = _claim(client, payload["code"])["token"]
    headers = {"Authorization": f"Bearer {token}"}

    empty = client.post("/api/ingest/readings", json={}, headers=headers)
    assert empty.status_code == 422

    out_of_range = client.post(
        "/api/ingest/readings", json={"soil_moisture_pct": 140}, headers=headers
    )
    assert out_of_range.status_code == 422

    alone = client.post(
        "/api/ingest/readings", json={"distance_cm": 87.2}, headers=headers
    )
    assert alone.status_code == 201


def test_sensors_endpoint_returns_latest_and_series(client, field):
    payload = _pairing_code(client, field["id"])
    token = _claim(client, payload["code"])["token"]
    headers = {"Authorization": f"Bearer {token}"}

    for moisture in (18.0, 21.0, 25.5):
        response = client.post(
            "/api/ingest/readings",
            json={"soil_moisture_pct": moisture, "air_temp_c": 26.0},
            headers=headers,
        )
        assert response.status_code == 201

    sensors = client.get(f"/api/fields/{field['id']}/sensors")
    assert sensors.status_code == 200
    body = sensors.json()
    assert body["field_id"] == field["id"]
    assert len(body["readings"]) == 3
    assert body["latest"]["soil_moisture_pct"] == 25.5
    assert body["devices"][0]["token_prefix"].startswith("ags_")
    assert body["devices"][0]["last_seen_at"] is not None

    missing = client.get("/api/fields/999999/sensors")
    assert missing.status_code == 404


def test_token_is_stored_hashed(client, field):
    payload = _pairing_code(client, field["id"])
    token = _claim(client, payload["code"])["token"]

    with SessionLocal() as session:
        row = session.scalar(select(RobotDevice).order_by(RobotDevice.id.desc()).limit(1))
        assert row.token_hash != token
        assert len(row.token_hash) == 64


def test_revoked_device_cannot_post(client, field):
    payload = _pairing_code(client, field["id"])
    claimed = _claim(client, payload["code"])
    token = claimed["token"]
    device_id = claimed["device"]["id"]

    assert client.delete(f"/api/devices/{device_id}").status_code == 204

    rejected = client.post(
        "/api/ingest/readings",
        json={"soil_moisture_pct": 22.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rejected.status_code == 401

    sensors = client.get(f"/api/fields/{field['id']}/sensors").json()
    assert sensors["devices"][0]["active"] is False


def test_direct_device_creation_and_listing(client, field):
    response = client.post(
        "/api/devices", json={"field_id": field["id"], "label": "Direct node"}
    )
    assert response.status_code == 201
    assert response.json()["device"]["label"] == "Direct node"

    listed = client.get("/api/devices", params={"field_id": field["id"]})
    assert listed.status_code == 200
    assert any(item["label"] == "Direct node" for item in listed.json())


def test_deleting_field_removes_devices_and_readings(client):
    created = client.post(
        "/api/fields",
        json={
            "name": "Robotics teardown field",
            "latitude": 30.1,
            "longitude": 31.2,
            "crop_id": "wheat",
            "planting_date": "2025-11-10",
            "soil_texture": "loam",
        },
    )
    assert created.status_code == 201, created.text
    field_id = created.json()["id"]

    payload = _pairing_code(client, field_id)
    token = _claim(client, payload["code"])["token"]
    client.post(
        "/api/ingest/readings",
        json={"soil_moisture_pct": 19.0},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert client.delete(f"/api/fields/{field_id}").status_code == 204
    assert client.get("/api/devices", params={"field_id": field_id}).json() == []