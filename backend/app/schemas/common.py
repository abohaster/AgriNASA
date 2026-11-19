"""Shared schema objects (provenance, modes, errors)."""

from typing import Literal

from pydantic import BaseModel, Field

DataNature = Literal[
    "satellite_observation",
    "reanalysis",
    "assimilated",
    "estimated",
    "derived",
    "calculated",
    "measured",
    "optional",
]

DataMode = Literal["live", "demo"]


class DataSourceRef(BaseModel):
    """Provenance attached to every visualisation."""

    id: str
    name: str
    nature: DataNature
    resolution: str | None = None
    attribution: str
    url: str | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: str | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class OkResponse(BaseModel):
    ok: bool = Field(default=True)
