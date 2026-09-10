"""Estimator, bootstrap and placebo coverage (``engine.ts``).

The bootstrap consumes the seeded stream in exactly the order the reference
loop does — shock draw, one draw per parcel cell, one per far unit, one per
near unit, two for the transfer coefficient — but evaluates all iterations at
once as numpy columns. Sums over resampled elements accumulate column by
column so the floating-point order matches the sequential reference.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np

from .controls import draw_controls
from .jsnum import round4
from .rng import Mulberry32, fnv1a32, random_normal, stream
from .series import UnitSeries
from .stats import mean, quantile


@dataclass
class Estimate:
    parcel_change: float
    far_change: float
    near_change: float
    leakage: float
    did: float
    additional: float

    def to_dict(self) -> dict[str, float]:
        return {
            "parcelChange": self.parcel_change,
            "farChange": self.far_change,
            "nearChange": self.near_change,
            "leakage": self.leakage,
            "did": self.did,
            "additional": self.additional,
        }


def estimate(parcel_change: float, far: list[UnitSeries], near: list[UnitSeries], plan: dict[str, Any]) -> Estimate:
    far_change = mean([u.change() for u in far])
    near_change = mean([u.change() for u in near]) if near else far_change
    leakage = far_change - near_change
    if plan["leakage"]["floorAtZero"]:
        leakage = max(0.0, leakage)
    did = parcel_change - far_change
    return Estimate(parcel_change, far_change, near_change, leakage, did, did - leakage)


def _bootstrap_inputs(parcel_cells: list[UnitSeries], far: list[UnitSeries], near: list[UnitSeries], plan: dict[str, Any]):
    cell_changes = np.asarray([c.change() for c in parcel_cells], dtype=np.float64)
    cell_weights = np.asarray([c.area_ha for c in parcel_cells], dtype=np.float64)
    far_changes = [u.change() for u in far]
    near_changes = [u.change() for u in near]
    far_mean = mean(far_changes)
    if plan["uncertainty"]["controlMatchingShock"]["method"] == "far_ring_residual_v1":
        residuals = np.asarray([c - far_mean for c in far_changes], dtype=np.float64)
    else:
        residuals = np.zeros(1, dtype=np.float64)
    return cell_changes, cell_weights, np.asarray(far_changes), np.asarray(near_changes), residuals


def bootstrap_additional_ha(
    parcel_cells: list[UnitSeries],
    far: list[UnitSeries],
    near: list[UnitSeries],
    area_ha: float,
    plan: dict[str, Any],
    iterations: int,
    seed: int,
) -> np.ndarray:
    """Additional hectares per bootstrap iteration; vectorised, stream-exact."""
    cell_changes, cell_weights, far_changes, near_changes, residuals = _bootstrap_inputs(parcel_cells, far, near, plan)
    n_cells, n_far, n_near = len(cell_changes), len(far_changes), len(near_changes)
    floor_leak = plan["leakage"]["floorAtZero"]
    coefficient = plan["uncertainty"]["modelTransfer"]["coefficient"]
    sd = plan["uncertainty"]["modelTransfer"]["sd"]
    per = 1 + n_cells + n_far + n_near + 2
    R = stream(seed, iterations * per).reshape(iterations, per)
    u = R[:, per - 2]
    v = R[:, per - 1]
    if np.any(u == 0.0) or np.any(v == 0.0):
        # A zero uniform makes the reference re-draw; fall back to the scalar loop.
        return _bootstrap_scalar(parcel_cells, far, near, area_ha, plan, iterations, seed)
    col = 0
    shock = residuals[np.floor(R[:, col] * len(residuals)).astype(np.int64)]
    col += 1
    s = np.zeros(iterations)
    ws = np.zeros(iterations)
    for k in range(n_cells):
        j = np.floor(R[:, col + k] * n_cells).astype(np.int64)
        s = s + cell_changes[j] * cell_weights[j]
        ws = ws + cell_weights[j]
    col += n_cells
    pc = np.where(ws > 0, s / np.where(ws > 0, ws, 1.0), 0.0) + shock
    acc = np.zeros(iterations)
    for k in range(n_far):
        j = np.floor(R[:, col + k] * n_far).astype(np.int64)
        acc = acc + far_changes[j]
    col += n_far
    fc = acc / n_far
    if n_near > 0:
        acc = np.zeros(iterations)
        for k in range(n_near):
            j = np.floor(R[:, col + k] * n_near).astype(np.int64)
            acc = acc + near_changes[j]
        nc = acc / n_near
    else:
        nc = fc
    col += n_near
    leak = fc - nc
    if floor_leak:
        leak = np.maximum(0.0, leak)
    additional_index = pc - fc - leak
    coef = np.maximum(0.0, coefficient + sd * np.sqrt(-2.0 * np.log(u)) * np.cos(2.0 * np.pi * v))
    return additional_index * coef * area_ha


def _bootstrap_scalar(parcel_cells, far, near, area_ha, plan, iterations, seed) -> np.ndarray:
    rng = Mulberry32(seed)
    cell_changes, cell_weights, far_changes, near_changes, residuals = _bootstrap_inputs(parcel_cells, far, near, plan)
    cell_changes, cell_weights = list(cell_changes), list(cell_weights)
    far_changes, near_changes, residuals = list(far_changes), list(near_changes), list(residuals)
    floor_leak = plan["leakage"]["floorAtZero"]
    coefficient = plan["uncertainty"]["modelTransfer"]["coefficient"]
    sd = plan["uncertainty"]["modelTransfer"]["sd"]
    out = np.zeros(iterations)
    n = len(cell_changes)
    for i in range(iterations):
        shock = residuals[math.floor(rng() * len(residuals))]
        s = 0.0
        ws = 0.0
        for _ in range(n):
            j = math.floor(rng() * n)
            s += cell_changes[j] * cell_weights[j]
            ws += cell_weights[j]
        pc = (s / ws if ws > 0 else 0.0) + shock
        fc = mean([far_changes[math.floor(rng() * len(far_changes))] for _ in far_changes])
        nc = mean([near_changes[math.floor(rng() * len(near_changes))] for _ in near_changes]) if near_changes else fc
        leak = fc - nc
        if floor_leak:
            leak = max(0.0, leak)
        coef = max(0.0, random_normal(rng, coefficient, sd))
        out[i] = (pc - fc - leak) * coef * area_ha
    return out


def empirical_coverage(series: list[UnitSeries], plan: dict[str, Any], seed: int) -> dict[str, Any]:
    """Placebo-in-space over far-ring units: fraction of null intervals containing zero."""
    cov = plan["uncertainty"]["coverage"]
    max_water = plan["controlRule"]["maxWaterFraction"]
    candidates = sorted(
        (
            u
            for u in series
            if u.zone == "far"
            and u.pre_level is not None
            and u.pre_slope is not None
            and u.post_composite is not None
            and u.water_fraction <= max_water
        ),
        key=lambda u: u.unit_id,
    )
    rng = Mulberry32((seed ^ 0x5EED) & 0xFFFFFFFF)
    chosen: list[UnitSeries] = []
    pool = list(candidates)
    while len(chosen) < cov["maxPlacebos"] and pool:
        chosen.append(pool.pop(math.floor(rng() * len(pool))))
    hits = 0
    n = 0
    alpha = 1 - plan["uncertainty"]["confidenceLevel"]
    min_matched = plan["controlRule"]["matching"]["minMatched"]
    for pseudo in chosen:
        far = draw_controls("far", pseudo.pre_level, pseudo.pre_slope, series, plan, pseudo.unit_id)  # type: ignore[arg-type]
        if len(far.matched) < min_matched:
            continue
        draws = bootstrap_additional_ha(
            [pseudo], far.matched, [], pseudo.area_ha, plan, cov["bootstrapIterations"], (seed ^ fnv1a32(pseudo.unit_id)) & 0xFFFFFFFF
        )
        lo = quantile(draws, alpha / 2)
        hi = quantile(draws, 1 - alpha / 2)
        n += 1
        if lo <= 0 <= hi:
            hits += 1
    return {"empirical": round4(hits / n) if n > 0 else None, "placebos": n}
