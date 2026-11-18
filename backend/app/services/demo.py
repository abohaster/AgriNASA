"""
Demo data provider.

The snapshot is a **real NASA POWER response** captured for Qena, Egypt
(2025-11-01 → 2026-03-10) and stored in `app/demo/qena_power_snapshot.json`.
Demo mode replays it through the normal pipeline and marks every response with
`is_demo=True`; the UI then shows a persistent DEMO DATA banner.

Important honesty rule: the snapshot has fixed coordinates and dates. It is not
the user's field. Analyses in demo mode use the snapshot's planting date for the
crop stage and report the snapshot end as `computed_for`, not today's date.
"""

import json
import logging
from datetime import date
from pathlib import Path
from threading import Lock

from app.config import get_settings

logger = logging.getLogger(__name__)

_lock = Lock()
_cached: tuple[float, object] | None = None


def load_demo_snapshot():
    """Load and normalise the cached snapshot once (invalidated on file change)."""
    global _cached

    # Imported lazily to avoid a circular import with nasa_power at module load.
    from app.services.nasa_power import DemoMetadata, NasaDailySeries, parse_daily_payload

    path: Path = get_settings().demo_snapshot_file
    try:
        mtime = path.stat().st_mtime
    except OSError:
        logger.error("Demo snapshot missing at %s", path)
        return None

    with _lock:
        if _cached is not None and _cached[0] == mtime:
            return _cached[1]

        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            metadata = raw["metadata"]
            start = date.fromisoformat(metadata["snapshot_start"])
            end = date.fromisoformat(metadata["snapshot_end"])
            values, elevation = parse_daily_payload(raw["response"], start=start, end=end)
            demo_field = metadata["demo_field"]
            series = NasaDailySeries(
                latitude=float(demo_field["latitude"]),
                longitude=float(demo_field["longitude"]),
                elevation_m=elevation,
                start=start,
                end=end,
                values=values,
                is_demo=True,
                demo=DemoMetadata(
                    snapshot_start=start,
                    snapshot_end=end,
                    planting_date=date.fromisoformat(demo_field["planting_date"]),
                    location_label=demo_field["location_label"],
                    notice=(
                        "Cached NASA POWER snapshot for Qena, Egypt. Not live data and not the "
                        "user's field. Crop stage uses the snapshot planting date (2025-11-15)."
                    ),
                ),
                notes=[
                    "Demo snapshot: real NASA POWER values for Qena, 2025-11-01 to 2026-03-10.",
                    "Demo analyses ignore the field's coordinates and planting date for crop stage.",
                ],
            )
            _cached = (mtime, series)
            return series
        except (OSError, KeyError, TypeError, ValueError) as exc:
            logger.exception("Could not load demo snapshot: %s", exc)
            return None
