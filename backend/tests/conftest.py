"""
Shared pytest configuration.

The environment is configured *before* importing the application so the cached
Settings object and SQLAlchemy engine point at an isolated test database. Demo
mode keeps the suite fully offline and deterministic.
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB = BACKEND_DIR / "data" / "test_agrinasa.db"

# Remove a previous run's database (and WAL side files) for a clean slate.
for suffix in ("", "-wal", "-shm"):
    candidate = Path(f"{TEST_DB}{suffix}")
    if candidate.exists():
        candidate.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["DATA_MODE"] = "demo"
os.environ["AI_API_KEY"] = ""
os.environ["GEE_SERVICE_ACCOUNT"] = ""
os.environ["GEE_PROJECT"] = ""
os.environ["GEE_PRIVATE_KEY_FILE"] = ""
os.environ["GEE_PRIVATE_KEY_JSON"] = ""
os.environ["ENVIRONMENT"] = "test"

# Make `import app...` work when pytest is launched from the backend directory.
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def field(client):
    """Create a field through the public API and remove it afterwards."""
    response = client.post(
        "/api/fields",
        json={
            "name": "Test wheat field",
            "latitude": 26.15,
            "longitude": 32.72,
            "crop_id": "wheat",
            "planting_date": "2025-11-15",
            "area_ha": 2.5,
            "soil_texture": "loam",
            "irrigation_system": "sprinkler",
            "location_label": "Qena, Egypt",
        },
    )
    assert response.status_code == 201, response.text
    payload = response.json()

    yield payload

    client.delete(f"/api/fields/{payload['id']}")
