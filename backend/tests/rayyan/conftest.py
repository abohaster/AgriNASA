"""Test harness for RAYAN: isolated app, mock Gemini transport, clean state."""

from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path

import httpx
import pytest
from cryptography.fernet import Fernet

BACKEND_DIR = Path(__file__).resolve().parents[2]
TEST_KEYFILE = BACKEND_DIR / "data" / "test_rayyan_keys.key"
if TEST_KEYFILE.exists():
    TEST_KEYFILE.unlink()

os.environ["RAYAN_ENCRYPTION_KEY"] = Fernet.generate_key().decode("ascii")
os.environ["RAYAN_KEYFILE_PATH"] = str(TEST_KEYFILE)
os.environ["RAYAN_SETTINGS_TOKEN"] = "test-settings-token"
os.environ["RAYAN_GEMINI_API_KEY"] = ""
os.environ["RAYAN_GEMINI_MODEL"] = ""
os.environ["RAYAN_MAX_REQUESTS_PER_HOUR"] = "500"
os.environ["RAYAN_GEMINI_TIMEOUT_SECONDS"] = "5"
os.environ["RAYAN_GEMINI_VALIDATION_TIMEOUT_SECONDS"] = "5"

from fastapi.testclient import TestClient  # noqa: E402

from app.rayyan import gemini, keystore  # noqa: E402
from app.rayyan.gemini import directory  # noqa: E402
from app.rayyan.memory import store as conversation_store  # noqa: E402
from app.rayyan.model_health import verified_models  # noqa: E402

ADMIN_HEADERS = {"X-Rayyan-Settings-Token": "test-settings-token"}


def _synthetic_key(label: str, prefix: str) -> str:
    """Derive key-shaped test values; deterministic and never a real secret."""
    digest = hashlib.sha256(f"rayyan-test-key:{label}".encode("ascii")).digest()
    return prefix + base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


ALPHA = _synthetic_key("alpha", "AIza")
BETA = _synthetic_key("beta", "AIza")
UNKNOWN = _synthetic_key("unknown", "AIza")
# Google AI Studio now issues Authorization API keys with an "AQ." prefix.
AQ_VALID = _synthetic_key("aq-valid", "AQ.")
ACCEPTED_KEYS = {ALPHA, BETA, AQ_VALID}

MODELS = [
    "models/gemini-2.5-flash",
    "models/gemini-3.5-flash",
    "models/gemini-4-hydrogen",
    "models/gemini-flash-latest",
]

SAFE_TEXT = (
    "The computed irrigation need is shown in the field context, and this reply adds no "
    "new figures. NASA POWER provides coarse reanalysis rather than on-farm measurements. "
    "Treat the refill estimate as decision support, not a prescription."
)


class FakeGemini:
    def __init__(self) -> None:
        self.mode = "ok"  # ok | invalid | quota | timeout
        self.model_modes: dict[str, str] = {}
        self.requests: list[httpx.Request] = []
        self.generate_text = SAFE_TEXT

    @property
    def generated(self) -> list[httpx.Request]:
        return [
            request
            for request in self.requests
            if request.url.path.endswith("/interactions")
            or ":generateContent" in request.url.path
        ]

    @staticmethod
    def _requested_model(request: httpx.Request) -> str:
        if request.url.path.endswith("/interactions"):
            try:
                body = json.loads(request.content.decode("utf-8"))
            except ValueError:
                return ""
            return str(body.get("model", "")).removeprefix("models/")
        marker = "/models/"
        if marker in request.url.path and ":generateContent" in request.url.path:
            return request.url.path.split(marker, 1)[1].split(":", 1)[0]
        return ""

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        key = request.headers.get("x-goog-api-key", "")
        model = self._requested_model(request)
        mode = self.model_modes.get(model, self.mode) if model else self.mode

        if mode == "timeout":
            raise httpx.ReadTimeout("simulated timeout", request=request)
        if mode == "connect_timeout":
            raise httpx.ConnectTimeout("simulated connect timeout", request=request)
        if mode == "network":
            raise httpx.ConnectError("simulated network failure", request=request)
        if mode == "invalid" or key not in ACCEPTED_KEYS:
            return httpx.Response(
                403,
                json={
                    "error": {
                        "code": 403,
                        "status": "PERMISSION_DENIED",
                        "message": "API key not valid. Please pass a valid API key.",
                    }
                },
            )
        if mode == "quota":
            return httpx.Response(
                429,
                json={
                    "error": {
                        "code": 429,
                        "status": "RESOURCE_EXHAUSTED",
                        "message": "Quota exceeded for this project.",
                        "details": [
                            {
                                "@type": "type.googleapis.com/google.rpc.RetryInfo",
                                "retryDelay": "30s",
                            }
                        ],
                    }
                },
            )
        if mode == "not_found":
            return httpx.Response(
                404,
                json={
                    "error": {
                        "code": 404,
                        "status": "NOT_FOUND",
                        "message": f"The model {model} is not found.",
                    }
                },
            )
        if mode == "server":
            return httpx.Response(
                503,
                json={
                    "error": {
                        "code": 503,
                        "status": "UNAVAILABLE",
                        "message": "The model is currently unavailable.",
                    }
                },
            )
        if mode == "overloaded":
            return httpx.Response(
                503,
                json={
                    "error": {
                        "code": 503,
                        "status": "UNAVAILABLE",
                        "message": "This model is currently experiencing high demand.",
                    }
                },
            )

        if request.url.path.endswith("/models"):
            return httpx.Response(
                200,
                json={
                    "models": [
                        {"name": name, "supportedGenerationMethods": ["generateContent"]}
                        for name in MODELS
                    ]
                },
            )

        text = "" if mode == "empty" else self.generate_text
        if request.url.path.endswith("/interactions"):
            return httpx.Response(
                200,
                json={
                    "id": "interaction-test",
                    "status": "completed",
                    "steps": [
                        {
                            "type": "model_output",
                            "content": [{"type": "text", "text": text}],
                        }
                    ],
                    "usage": {"total_input_tokens": 120, "total_output_tokens": 90},
                },
            )

        if ":generateContent" in request.url.path:
            return httpx.Response(
                200,
                json={
                    "candidates": [
                        {
                            "finishReason": "STOP",
                            "content": {"parts": [{"text": text}] if text else []},
                        }
                    ],
                    "usageMetadata": {"totalTokenCount": 210},
                },
            )

        return httpx.Response(404, json={"error": {"message": "not found"}})


@pytest.fixture(scope="session")
def fake() -> FakeGemini:
    instance = FakeGemini()
    gemini.set_transport_override(httpx.MockTransport(instance.handler))
    yield instance
    gemini.set_transport_override(None)


@pytest.fixture(scope="session")
def rayyan_client(fake: FakeGemini) -> TestClient:
    from app.db.database import engine
    from app.rayyan.standalone import create_rayyan_app

    keystore.ensure_schema(engine)
    with TestClient(create_rayyan_app()) as client:
        yield client


@pytest.fixture(autouse=True)
def clean_state(fake: FakeGemini):
    from app.ai.rate_limit import SlidingWindowLimiter
    from app.db.database import SessionLocal, engine
    from app.db.models import PublicApiAccessToken, PublicApiKey
    from app.rayyan import api, orchestrator, public_api
    from sqlalchemy import delete

    keystore.ensure_schema(engine)
    with SessionLocal() as session:
        session.execute(keystore.rayyan_api_keys.delete())
        session.execute(delete(PublicApiAccessToken))
        session.execute(delete(PublicApiKey))
        session.commit()

    # Each test gets a fresh budget: the limiters are process-wide and the
    # suite runs far more requests than one hour of real traffic would.
    public_api.admin_limiter = SlidingWindowLimiter()
    orchestrator.limiter = SlidingWindowLimiter()
    api.limiter = orchestrator.limiter

    directory.clear()
    verified_models.clear()
    conversation_store.clear()
    fake.mode = "ok"
    fake.model_modes.clear()
    fake.requests.clear()
    fake.generate_text = SAFE_TEXT
    yield


@pytest.fixture
def admin() -> dict[str, str]:
    return dict(ADMIN_HEADERS)


def create_key(client: TestClient, *, label: str, api_key: str, model: str | None = None):
    payload = {"label": label, "api_key": api_key}
    if model:
        payload["model"] = model
    return client.post("/api/rayyan/settings/keys", headers=ADMIN_HEADERS, json=payload)
