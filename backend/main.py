"""
Convenience entrypoint so `uvicorn main:app --reload` works from `backend/`.

The application itself is defined in `app/main.py`; this file only re-exports it,
which keeps the package importable by tests and tools.
"""

from app.main import app

__all__ = ["app"]
