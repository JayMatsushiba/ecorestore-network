"""The analysis pipeline: plan + Tier 0 snapshot → numbers (``analyseTier0`` in ``engine.ts``).

    Unit series → controls drawn by the committed rule (near + far ring)
    → parallel-trend diagnostic → DiD against the far ring → leakage from
    near/far divergence → bootstrap interval → placebo coverage

Pure in its inputs. Returns the ``AnalysisOutput`` shape of
``verification/analysis-contract.ts`` as a plain dict with no NaN anywhere:
non-computable quantities are ``None``.
"""

from __future__ import annotations

import math
from typing import Any

from . import ENGINE
from .controls import draw_controls, summarise_controls
from .diagnostics import NOT_EVALUATED, parallel_trend
from .estimator import bootstrap_additional_ha, empirical_coverage, estimate
from .jsnum import round4
from .series import build_unit_series, scenes_in_window
from .stats import quantile, seq_sum


def analyse(plan: dict[str, Any], t0: dict[str, Any], *, plan_hash: str, snapshot_hash: str) -> dict[str, Any]:
    series = build_unit_series(t0, plan)
    parcel = next((u for u in series if u.zone == "parcel"), None)
    if parcel is None:
        raise ValueError("snapshot has no parcel unit")
    parcel_cells = [u for u in series if u.zone == "parcel_cell" and u.pre_level is not None and u.post_composite is not None]
    area_ha = parcel.area_ha
    observations = t0["observations"]

    windows = [*plan["windows"]["pre"], *plan["windows"]["post"]]
    scenes_per_window = []
    for w in windows:
        ids = scenes_in_window(t0, plan, w)
        usable = sum(1 for sid in ids if (o := observations.get(sid)) is not None and o["ndvi"][parcel.index] is not None)
        scenes_per_window.append({"label": w["label"], "usable": usable})

    target_level = parcel.pre_level if parcel.pre_level is not None else math.nan
    target_slope = parcel.pre_slope if parcel.pre_slope is not None else math.nan
    far = draw_controls("far", target_level, target_slope, series, plan)
    near = draw_controls("near", target_level, target_slope, series, plan)
    enough_controls = len(far.matched) >= plan["controlRule"]["matching"]["minMatched"]

    pt = parallel_trend(parcel, far.matched, plan) if enough_controls else NOT_EVALUATED

    parcel_change = parcel.change() if parcel.post_composite is not None and parcel.pre_level is not None else None
    est = estimate(parcel_change, far.matched, near.matched, plan) if enough_controls and parcel_change is not None else None

    unc = plan["uncertainty"]
    alpha = 1 - unc["confidenceLevel"]
    interval = None
    if est is not None:
        draws = bootstrap_additional_ha(
            parcel_cells if parcel_cells else [parcel], far.matched, near.matched, area_ha, plan, unc["bootstrapIterations"], unc["seed"]
        )
        interval = {"lower": round4(quantile(draws, alpha / 2)), "upper": round4(quantile(draws, 1 - alpha / 2))}
    coverage = empirical_coverage(series, plan, unc["seed"]) if est is not None else {"empirical": None, "placebos": 0}

    threshold = plan["gates"]["noNetHabitatLoss"]["ndviDropThreshold"]
    loss_area = seq_sum(c.area_ha for c in parcel_cells if c.change() < threshold)
    cell_area = seq_sum(c.area_ha for c in parcel_cells)

    usable_scenes = sum(1 for o in observations.values() if o["ndvi"][parcel.index] is not None)

    return {
        "engine": dict(ENGINE),
        "planHash": plan_hash,
        "snapshotHash": snapshot_hash,
        "parcel": {
            "unitId": parcel.unit_id,
            "areaHa": area_ha,
            "preLevel": parcel.pre_level,
            "preSlope": parcel.pre_slope,
            "postComposite": parcel.post_composite,
            "changeIndex": parcel_change,
        },
        "parcelCells": {"count": len(parcel_cells), "areaHa": cell_area, "lossCellFraction": loss_area / cell_area if cell_area > 0 else 1},
        "stacSceneIds": sorted(sid for w in windows for sid in scenes_in_window(t0, plan, w)),
        "scenesPerWindow": scenes_per_window,
        "controlSets": [
            summarise_controls(far, plan["controlRule"]["farRing"]),
            summarise_controls(near, plan["controlRule"]["nearRing"]),
        ],
        "parallelTrend": pt.to_dict(),
        "estimate": est.to_dict() if est is not None else None,
        "interval": interval,
        "coverage": coverage,
        "tier0Usable": {"usableScenes": usable_scenes, "totalScenes": len(t0["scenes"])},
    }
