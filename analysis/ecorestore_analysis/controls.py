"""Control drawing — by the committed rule, never chosen (``drawControls`` in ``engine.ts``)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from .jsnum import round4
from .series import UnitSeries
from .stats import mean, sample_sd


@dataclass
class DrawnControls:
    ring: str
    candidates: int
    excluded_water: int
    matched: list[UnitSeries]


def _sd_or_floor(xs: list[float]) -> float:
    sd = sample_sd(xs)
    # JS: `sampleSd(x) || 1e-6` — NaN and 0 both fall through to the floor.
    if sd == 0 or math.isnan(sd):
        return 1e-6
    return sd


def draw_controls(
    ring: str,
    target_pre_level: float,
    target_pre_slope: float,
    pool: list[UnitSeries],
    plan: dict[str, Any],
    exclude_unit_id: str | None = None,
) -> DrawnControls:
    rule = plan["controlRule"]
    matching = rule["matching"]
    max_water = rule["maxWaterFraction"]
    in_ring = [u for u in pool if u.zone == ring and u.unit_id != exclude_unit_id]
    excluded_water = sum(1 for u in in_ring if u.water_fraction > max_water)
    usable = [
        u
        for u in in_ring
        if u.water_fraction <= max_water and u.pre_level is not None and u.pre_slope is not None and u.post_composite is not None
    ]
    sd_level = _sd_or_floor([u.pre_level for u in usable])  # type: ignore[misc]
    sd_slope = _sd_or_floor([u.pre_slope for u in usable])  # type: ignore[misc]
    use_level = "pre_level" in matching["covariates"]
    use_slope = "pre_slope" in matching["covariates"]
    caliper = matching["caliperSd"]
    scored: list[tuple[float, str, UnitSeries]] = []
    for u in usable:
        dl = (u.pre_level - target_pre_level) / sd_level if use_level else 0.0  # type: ignore[operator]
        ds = (u.pre_slope - target_pre_slope) / sd_slope if use_slope else 0.0  # type: ignore[operator]
        if abs(dl) <= caliper and abs(ds) <= caliper:
            scored.append((math.sqrt(dl * dl + ds * ds), u.unit_id, u))
    scored.sort(key=lambda s: (s[0], s[1]))
    return DrawnControls(ring, len(in_ring), excluded_water, [s[2] for s in scored[: matching["k"]]])


def summarise_controls(d: DrawnControls, geometry: dict[str, Any]) -> dict[str, Any]:
    m = d.matched
    return {
        "ring": d.ring,
        "geometry": geometry,
        "candidates": d.candidates,
        "excludedWater": d.excluded_water,
        "matched": len(m),
        "matchedUnitIds": [u.unit_id for u in m],
        "meanPreLevel": round4(mean([u.pre_level for u in m])) if m else 0,  # type: ignore[misc]
        "meanPreSlope": round4(mean([u.pre_slope for u in m])) if m else 0,  # type: ignore[misc]
        "changeIndex": round4(mean([u.change() for u in m])) if m else 0,
    }
