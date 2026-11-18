"""
Crop registry.

A CropProfile is the *only* place crop constants live: Kc values, stage lengths,
rooting depth and stress thresholds. Science functions receive a profile and
never hard-code wheat values, so adding a crop is a data change, not a model
change.

All values are FAO-56 defaults; they are agronomic reference values, not
measurements from a specific field. See `wheat.py` for sources.
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class StageSpec:
    """One growth stage, with Kc interpolated linearly from start to end."""

    code: str
    name: str
    days: int
    kc_start: float
    kc_end: float


@dataclass(frozen=True)
class VegetationExpectation:
    """NDVI/NDMI bands expected for one growth stage.

    These are documented agronomic heuristics, not calibrated thresholds for a
    specific field or variety. They let the same NDVI value be read relative to
    the stage: 0.35 is a full canopy for young wheat but sparse for a bulking
    potato crop. Values are unitless index values.
    """

    # Below ``ndvi_sparse_max`` the canopy is sparse for this stage; above
    # ``ndvi_dense_min`` it is dense. Between them the canopy is moderate.
    ndvi_sparse_max: float
    ndvi_dense_min: float
    # Below ``ndmi_low_max`` canopy water content is low for this stage; above
    # ``ndmi_high_min`` it is high.
    ndmi_low_max: float
    ndmi_high_min: float


@dataclass(frozen=True)
class CropProfile:
    id: str
    name: str
    scientific_name: str
    stages: tuple[StageSpec, ...]
    # Rooting depth (m) grows linearly from emergence to the end of the season.
    root_depth_initial_m: float
    root_depth_max_m: float
    # FAO-56 "p": fraction of TAW that crops can extract without stress.
    depletion_fraction_p: float
    # Simple runoff coefficient used when slope/cover data is unavailable (0–1).
    runoff_coefficient: float
    # Daily maximum temperature (°C) above which heat stress is plausible.
    heat_stress_threshold_c: float
    # Daily minimum temperature (°C) at/below which frost is flagged.
    frost_threshold_c: float
    notes: str
    # Per-stage NDVI/NDMI bands keyed by stage code. An empty mapping means the
    # global vegetation classes in app.science.sar_moisture are used unchanged.
    stage_expectations: dict[str, VegetationExpectation] = field(default_factory=dict)

    @property
    def season_length_days(self) -> int:
        return sum(stage.days for stage in self.stages)

    def expectation_for_stage(self, stage_code: str) -> VegetationExpectation | None:
        return self.stage_expectations.get(stage_code)

    @property
    def kc_initial(self) -> float:
        return self.stages[0].kc_start

    @property
    def kc_mid(self) -> float:
        return max(stage.kc_start for stage in self.stages)

    @property
    def kc_end(self) -> float:
        return self.stages[-1].kc_end


_REGISTRY: Dict[str, CropProfile] = {}


def register_crop(profile: CropProfile) -> CropProfile:
    """Register a crop so API/services can resolve it by id."""
    if profile.id in _REGISTRY:
        raise ValueError(f"Crop '{profile.id}' is already registered")
    _REGISTRY[profile.id] = profile
    return profile


def get_crop(crop_id: str) -> CropProfile | None:
    return _REGISTRY.get(crop_id)


def list_crops() -> list[CropProfile]:
    return list(_REGISTRY.values())
