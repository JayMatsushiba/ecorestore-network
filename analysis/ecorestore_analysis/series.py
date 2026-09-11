"""Unit-level series from the Tier 0 snapshot (``buildUnitSeries`` in ``engine.ts``)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .stats import day_of_year, mean, median, years_since_2000


@dataclass
class UnitSeries:
    unit: dict[str, Any]
    index: int
    pre_composites: list[float | None]
    post_composite: float | None
    pre_level: float | None
    pre_slope: float | None
    water_fraction: float
    pre_observations: list[tuple[float, float, float]] = field(default_factory=list)  # (t, doy, ndvi)

    @property
    def unit_id(self) -> str:
        return self.unit["unitId"]

    @property
    def zone(self) -> str:
        return self.unit["zone"]

    @property
    def area_ha(self) -> float:
        return self.unit["areaHa"]

    def change(self) -> float:
        return self.post_composite - self.pre_level  # type: ignore[operator]


def in_window(datetime_str: str, w: dict[str, Any]) -> bool:
    d = datetime_str[:10]
    return w["start"] <= d <= w["end"]


def scenes_in_window(snapshot: dict[str, Any], plan: dict[str, Any], w: dict[str, Any]) -> list[str]:
    max_cloud = plan["index"]["maxSceneCloudCoverPct"]
    return [s["sceneId"] for s in snapshot["scenes"] if in_window(s["datetime"], w) and s["cloudCoverPct"] <= max_cloud]


def window_mid_year(w: dict[str, Any]) -> float:
    return (years_since_2000(w["start"]) + years_since_2000(w["end"])) / 2


def _composite(scene_ids: list[str], unit_index: int, snapshot: dict[str, Any]) -> float | None:
    vals: list[float] = []
    obs = snapshot["observations"]
    for sid in scene_ids:
        o = obs.get(sid)
        if o is None:
            continue
        v = o["ndvi"][unit_index]
        if v is not None:
            vals.append(v)
    return median(vals) if vals else None


def _check_shape(snapshot: dict[str, Any], pre_windows: list[dict[str, Any]]) -> None:
    """Reject a document the engine cannot analyse, with a message, rather than
    fail on an index deep inside a loop. Receipts prove the bytes are the ones
    sent; they say nothing about whether the arrays inside line up."""
    n = len(snapshot["units"])
    if not isinstance(snapshot["observations"], dict):
        raise ValueError("observations must be an object keyed by scene id")
    for sid, o in snapshot["observations"].items():
        for key in ("ndvi", "validFraction", "waterFraction"):
            if len(o[key]) != n:
                raise ValueError(f"scene {sid}: {key} has {len(o[key])} entries for {n} units")
    # The pre-slope divides by the gap between the first and last *valid*
    # composites, which can be any pair once cloudy windows drop out, so every
    # pre window needs its own mid-date.
    seen: dict[float, str] = {}
    for w in pre_windows:
        mid = window_mid_year(w)
        if mid in seen:
            raise ValueError(f"pre windows {seen[mid]!r} and {w['label']!r} have the same mid-date; no pre-slope is defined")
        seen[mid] = w["label"]


def build_unit_series(snapshot: dict[str, Any], plan: dict[str, Any]) -> list[UnitSeries]:
    pre_windows = plan["windows"]["pre"]
    post_windows = plan["windows"]["post"]
    _check_shape(snapshot, pre_windows)
    pre_scene_ids = [scenes_in_window(snapshot, plan, w) for w in pre_windows]
    post_scene_ids = [sid for w in post_windows for sid in scenes_in_window(snapshot, plan, w)]
    scene_by_id = {s["sceneId"]: s for s in snapshot["scenes"]}
    observations = snapshot["observations"]
    out: list[UnitSeries] = []
    for index, unit in enumerate(snapshot["units"]):
        pre_composites = [_composite(ids, index, snapshot) for ids in pre_scene_ids]
        post_composite = _composite(post_scene_ids, index, snapshot)
        valid_pre = [v for v in pre_composites if v is not None]
        pre_level = mean(valid_pre) if valid_pre else None
        pre_slope: float | None = None
        if len(pre_composites) >= 2:
            pts = [(v, window_mid_year(pre_windows[i])) for i, v in enumerate(pre_composites) if v is not None]
            if len(pts) >= 2:
                (v0, t0), (v1, t1) = pts[0], pts[-1]
                pre_slope = (v1 - v0) / (t1 - t0)
        pre_obs: list[tuple[float, float, float]] = []
        water_sum = 0.0
        water_n = 0
        for ids in pre_scene_ids:
            for sid in ids:
                o = observations.get(sid)
                scene = scene_by_id.get(sid)
                if o is None or scene is None:
                    continue
                v = o["ndvi"][index]
                wf = o["waterFraction"][index]
                water_sum += wf if wf is not None else 0
                water_n += 1
                if v is None:
                    continue
                pre_obs.append((years_since_2000(scene["datetime"]), day_of_year(scene["datetime"]), v))
        out.append(
            UnitSeries(
                unit=unit,
                index=index,
                pre_composites=pre_composites,
                post_composite=post_composite,
                pre_level=pre_level,
                pre_slope=pre_slope,
                water_fraction=water_sum / water_n if water_n > 0 else 0.0,
                pre_observations=pre_obs,
            )
        )
    return out
