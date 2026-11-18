"""Location intelligence routes and honest-degradation behaviour."""

from app.services import explore


SQUARE = {
    "type": "Polygon",
    "coordinates": [
        [
            [30.46, 31.03],
            [30.47, 31.03],
            [30.47, 31.04],
            [30.46, 31.04],
            [30.46, 31.03],
        ]
    ],
}


def test_crops_catalogue_is_labelled_as_screening(client):
    response = client.get("/api/location/crops")
    assert response.status_code == 200
    body = response.json()
    assert body["crops"]
    assert {"id", "name", "ideal_months", "season_days"} <= set(body["crops"][0])
    assert "not a yield forecast" in body["note"]


def test_overview_point_passes_coordinates(monkeypatch, client):
    captured = {}

    def fake_overview(lat, lon, **kwargs):
        captured["lat"] = lat
        captured["lon"] = lon
        captured["kwargs"] = kwargs
        return {"available": True}

    monkeypatch.setattr(explore, "build_overview", fake_overview)
    response = client.get("/api/location/overview", params={"lat": 31.03, "lon": 30.46})
    assert response.status_code == 200
    assert captured["lat"] == 31.03
    assert captured["kwargs"]["label"] is None


def test_overview_area_passes_polygon(monkeypatch, client):
    captured = {}

    def fake_overview(lat, lon, **kwargs):
        captured.update(kwargs)
        return {"available": True, "area_ha": 104.0}

    monkeypatch.setattr(explore, "build_overview", fake_overview)
    response = client.post(
        "/api/location/overview",
        json={"latitude": 31.035, "longitude": 30.465, "geometry": SQUARE},
    )
    assert response.status_code == 200
    assert captured["geometry"] == SQUARE


def test_overview_rejects_invalid_latitude(client):
    response = client.get("/api/location/overview", params={"lat": 95, "lon": 30.46})
    assert response.status_code == 422


def test_history_years_is_bounded(client):
    response = client.get(
        "/api/location/history", params={"lat": 31.0, "lon": 30.4, "years": 2}
    )
    assert response.status_code == 422


def test_crop_requires_a_crop_id(client):
    response = client.get("/api/location/crop", params={"lat": 31.0, "lon": 30.4})
    assert response.status_code == 422


def test_soil_unavailable_is_reported_not_invented(monkeypatch):
    monkeypatch.setattr(explore.soilgrids, "fetch_soil", lambda *args, **kwargs: None)
    result = explore.build_soil(31.03, 30.46)
    assert result["available"] is False
    assert result["sources"] == []
    assert "no soil values" in result["reason"]
