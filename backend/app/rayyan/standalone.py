"""
Isolated FastAPI app for RAYAN.

It exists so the Gemini key management and chat can run and be tested without
modifying `app/main.py`. Once the two-line router inclusion is approved, the
same router is mounted on the main API and this app is no longer required in
deployment.

The app reuses the project's database engine and error envelope, but owns its
lifespan and CORS headers.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routers import assistant, demo, farmer, fields, geocode, meta, satellite
from app.config import get_settings
from app.db.database import engine, init_db
from app.exceptions import AppError
from app.rayyan import __version__, keystore
from app.rayyan.api import router
from app.rayyan.config import get_rayyan_settings

logger = logging.getLogger(__name__)

DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]


def _origins() -> list[str]:
    configured = list(get_settings().cors_origin_list)
    for origin in DEV_ORIGINS:
        if origin not in configured:
            configured.append(origin)
    return configured


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    keystore.ensure_schema(engine)
    settings = get_rayyan_settings()
    logger.info(
        "RAYAN API ready (gemini source: %s, settings auth: %s, data mode: %s)",
        "environment" if settings.bootstrap_configured else "none-or-saved",
        "token" if settings.token_required else "loopback-only",
        get_settings().data_mode,
    )
    yield


def create_rayyan_app() -> FastAPI:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    app = FastAPI(
        title="AgriNASA RAYAN API (isolated)",
        version=__version__,
        description=(
            "Google Gemini key management and grounded explanations for AgriNASA. "
            "No agronomic value is computed here; it is explained from the existing services."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        first = errors[0] if errors else {}
        location = " → ".join(str(part) for part in first.get("loc", []) if part != "body")
        message = first.get("msg", "The request could not be validated.")
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"{location}: {message}" if location else message,
                    # Never echo `first["input"]`: it can contain a pasted API key.
                    "details": "Check the highlighted fields and try again.",
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": str(exc.detail) if exc.detail else "The request could not be completed.",
                    "details": None,
                }
            },
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled RAYAN error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected server error occurred. The RAYAN service did not expose any key.",
                    "details": "Check the backend logs. Saved keys and settings were not changed.",
                }
            },
        )

    app.include_router(router, prefix="/api")

    # The standalone app also mounts the existing read/write routers so the
    # RAYAN screens can list fields and surface the same computed context it
    # explains. It does not replace or redirect any existing behaviour.
    app.include_router(meta.router, prefix="/api")
    app.include_router(fields.router, prefix="/api")
    app.include_router(geocode.router, prefix="/api")
    app.include_router(satellite.router, prefix="/api")
    app.include_router(satellite.alias_router, prefix="/api")
    app.include_router(farmer.router, prefix="/api")
    app.include_router(demo.router, prefix="/api")
    app.include_router(assistant.router, prefix="/api")


    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "service": "RAYAN (isolated)",
            "docs": "/docs",
            "health": "/api/rayyan/health",
        }

    return app


app = create_rayyan_app()
