"""
Run the isolated RAYAN API on port 8001.

Usage (from the backend directory):
    py -3.12 scripts/run_rayyan_api.py

This runner exists only to verify RAYAN before the router is included in the
main API. Once `app/main.py` mounts the router, `/api/rayyan/*` is served by the
normal backend and this script is unnecessary.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import uvicorn  # noqa: E402

from app.rayyan.standalone import app  # noqa: E402


def main() -> None:
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")


if __name__ == "__main__":
    main()
