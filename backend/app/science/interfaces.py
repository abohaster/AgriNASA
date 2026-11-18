"""Small value objects shared by science modules and services."""

from dataclasses import dataclass
from typing import Literal

DemandLevel = Literal["low", "moderate", "high", "unknown"]
ConfidenceLevel = Literal["high", "medium", "low"]


@dataclass(frozen=True)
class DemandClassification:
    level: DemandLevel
    reasons: list[str]


@dataclass(frozen=True)
class ConfidenceResult:
    level: ConfidenceLevel
    reasons: list[str]
