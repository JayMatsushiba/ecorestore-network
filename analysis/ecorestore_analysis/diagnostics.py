"""Parallel-trend diagnostic (``parallelTrendDiagnostic`` in ``engine.ts``).

    ndvi ~ b0 + b1·t + b2·treated + b3·(t·treated) + b4·sin(doy) + b5·cos(doy)

over pre-period scene observations; b3 is the pre-trend divergence.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np

from .jsnum import js_number_to_string, round6
from .series import UnitSeries
from .stats import ols


@dataclass
class ParallelTrend:
    status: str
    slope_diff_per_year: float | None
    p_value: float | None
    n_observations: int
    criterion: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "slopeDiffPerYear": self.slope_diff_per_year,
            "pValue": self.p_value,
            "nObservations": self.n_observations,
            "criterion": self.criterion,
        }


NOT_EVALUATED = ParallelTrend("NOT_EVALUATED", None, None, 0, "not evaluated: insufficient controls")


def parallel_trend(parcel: UnitSeries, controls: list[UnitSeries], plan: dict[str, Any]) -> ParallelTrend:
    pt = plan["parallelTrend"]
    rows: list[list[float]] = []
    y: list[float] = []

    def push(o: tuple[float, float, float], treated: float) -> None:
        t, doy, ndvi = o
        ang = (2 * math.pi * doy) / 365.25
        rows.append([1.0, t, treated, t * treated, math.sin(ang), math.cos(ang)])
        y.append(ndvi)

    for o in parcel.pre_observations:
        push(o, 1.0)
    for c in controls:
        for o in c.pre_observations:
            push(o, 0.0)
    criterion = (
        f"interaction p ≥ {js_number_to_string(pt['alpha'])} and |Δslope| ≤ "
        f"{js_number_to_string(pt['maxAbsSlopeDiffPerYear'])} NDVI/yr ({pt['test']})"
    )
    if len(rows) < 12 or len(parcel.pre_observations) < 4:
        return ParallelTrend("FAIL", None, None, len(rows), f"{criterion}; too few pre-period observations")
    try:
        fit = ols(np.asarray(rows, dtype=np.float64), np.asarray(y, dtype=np.float64))
    except (np.linalg.LinAlgError, ValueError):
        return ParallelTrend("FAIL", None, None, len(rows), f"{criterion}; singular design")
    slope_diff = float(fit.beta[3])
    p = float(fit.p_value[3])
    passed = p >= pt["alpha"] and abs(slope_diff) <= pt["maxAbsSlopeDiffPerYear"]
    return ParallelTrend("PASS" if passed else "FAIL", round6(slope_diff), round6(p), len(rows), criterion)
