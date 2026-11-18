"""
FastAPI application entrypoint.

Responsibilities kept here:
* CORS for the Vite dev server.
* Startup database creation/seed.
* One uniform JSON error envelope for every failure path, so the frontend can
  show friendly messages instead of raw stack traces.
* Router registration.

Business logic lives in `app/services`, `app/science` and `app/ai`.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routers import assistant, demo, farmer, fields, geocode, location, meta, satellite
from app.config import get_settings
from app.db.database import SessionLocal, engine, init_db
from app.exceptions import AppError
from app.rayyan import keystore
from app.rayyan.api import router as rayyan_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    keystore.ensure_schema(engine)
    if settings.seed_demo_trials:
        with SessionLocal() as session:
            demo.seed_demo_trials(session)
    logger.info("AgriNASA API ready (data mode: %s)", settings.data_mode)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "NASA-Powered Smart Agriculture Decision Support Platform for wheat, potato and tomato. "
        "Deterministic science computes all values; the optional AI only explains them."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Error envelope ──────────────────────────────────────────────────────────
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
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    location = " → ".join(str(part) for part in first.get("loc", []) if part != "body")
    message = first.get("msg", "The request could not be validated.")
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": f"{location}: {message}" if location else message,
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
    # Log the traceback for the developer, return a safe message to the user.
    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected server error occurred. Please try again.",
                "details": "If the problem persists, check the backend logs.",
            }
        },
    )


# ── Routes ──────────────────────────────────────────────────────────────────
app.include_router(meta.router, prefix="/api")
app.include_router(fields.router, prefix="/api")
app.include_router(geocode.router, prefix="/api")
app.include_router(location.router, prefix="/api")
app.include_router(satellite.router, prefix="/api")
app.include_router(satellite.alias_router, prefix="/api")
app.include_router(farmer.router, prefix="/api")
app.include_router(demo.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(rayyan_router, prefix="/api")


# ── Built frontend (single-container deployments) ───────────────────────────
# When `frontend/dist` exists (Docker image or a local `npm run build`), the
# same server serves the SPA. In development the Vite server proxies to /api,
# so this only affects the root URL.
_dist = Path(settings.frontend_dist)

if (_dist / "index.html").is_file():
    _assets = _dist / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def serve_frontend(path: str) -> FileResponse:
        if path.startswith("api/") or path in {"docs", "redoc", "openapi.json"}:
            raise HTTPException(status_code=404)
        candidate = (_dist / path).resolve()
        if candidate.is_file() and _dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")

else:

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "docs": "/docs",
            "health": "/api/health",
        }
