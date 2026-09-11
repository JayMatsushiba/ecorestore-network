"""STAC search against Earth Search (AWS Open Data) — REAL Tier 0 acquisition.

Sentinel-2 L2A Cloud-Optimized GeoTIFFs; no credentials required. Scene IDs
returned here are recorded in every result so a third party can re-run the
derivation.
"""

from __future__ import annotations

import re
from typing import Any

from pystac_client import Client

EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1"
S2_L2A_COLLECTION = "sentinel-2-l2a"
ASSET_HOST = "sentinel-cogs.s3.us-west-2.amazonaws.com"


def _scene_record(item: Any) -> dict[str, Any] | None:
    assets = item.assets
    red, nir, scl = assets.get("red"), assets.get("nir"), assets.get("scl")
    if red is None or nir is None or scl is None:
        return None
    bands = (red.extra_fields or {}).get("raster:bands") or [{}]
    band = bands[0] if bands else {}
    p = item.properties
    if p.get("eo:cloud_cover") is None or p.get("datetime") is None:
        return None  # cannot be filtered or placed in a window
    epsg = p.get("proj:epsg")
    if epsg is None and isinstance(p.get("proj:code"), str):
        m = re.fullmatch(r"\s*EPSG:(\d+)\s*", p["proj:code"], re.IGNORECASE)
        epsg = int(m.group(1)) if m else 0  # 0: unknown; acquire falls back to the tile
    return {
        "sceneId": item.id,
        "datetime": str(p["datetime"]),
        "platform": str(p.get("platform", "")),
        "cloudCoverPct": float(p["eo:cloud_cover"]),
        "processingBaseline": str(p.get("s2:processing_baseline", "")),
        "epsg": int(epsg or 0),
        "assets": {"red": red.href, "nir": nir.href, "scl": scl.href},
        "stacAdvertisedReflectance": {"scale": band.get("scale", 0.0001), "offset": band.get("offset", 0)},
    }


def mgrs_tile(scene_id: str) -> str:
    """The MGRS tile in an Earth Search id such as ``S2A_10TEM_20230721_0_L2A``."""
    return scene_id.split("_")[1]


def epsg_from_tile(tile: str) -> int:
    """EPSG code of an MGRS tile's UTM zone: ``10TEM`` → 32610; band letters
    C–M are south of the equator (327xx). 0 when the id is not an MGRS tile."""
    m = re.fullmatch(r"(\d{1,2})([C-HJ-NP-X])[A-Z]{2}", tile)
    if not m:
        return 0
    zone, band = int(m.group(1)), m.group(2)
    if not 1 <= zone <= 60:
        return 0
    return (32700 if band <= "M" else 32600) + zone


def _baseline_key(baseline: str) -> tuple[int, ...]:
    return tuple(int(part) for part in baseline.split(".") if part.isdigit())


def drop_reprocessed(scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep one item per acquisition when the catalogue holds reprocessings of it.

    Earth Search publishes some acquisitions twice — the original processing and
    the Collection-1 reprocessing (baseline 05.00) — as separate items a few
    minutes apart. Both describe the same ground on the same day, and counting
    them twice double-weights that day in every composite and in the
    parallel-trend regression. Within a (tile, platform, date) group, only the
    highest processing baseline survives. Items with equal baselines are all
    kept: two granules of one datatake, or the same tile seen from adjacent
    orbits on one day, are different observations.
    """
    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for s in scenes:
        groups.setdefault((mgrs_tile(s["sceneId"]), s["platform"], s["datetime"][:10]), []).append(s)
    kept: list[dict[str, Any]] = []
    for group in groups.values():
        best = max(_baseline_key(s["processingBaseline"]) for s in group)
        kept.extend(s for s in group if _baseline_key(s["processingBaseline"]) == best)
    return kept


def search_sentinel2(bbox: tuple[float, float, float, float], windows: list[dict[str, Any]], max_cloud_cover_pct: float) -> list[dict[str, Any]]:
    client = Client.open(EARTH_SEARCH_URL)
    scenes: dict[str, dict[str, Any]] = {}
    for w in windows:
        search = client.search(
            collections=[S2_L2A_COLLECTION],
            bbox=list(bbox),
            datetime=f"{w['start']}T00:00:00Z/{w['end']}T23:59:59Z",
            # `lte`, because `scenes_in_window()` keeps `cloudCoverPct <= max`;
            # the two rules must agree on a scene at the threshold.
            query={"eo:cloud_cover": {"lte": max_cloud_cover_pct}},
            limit=100,
        )
        for item in search.items():
            rec = _scene_record(item)
            if rec is not None:
                scenes[rec["sceneId"]] = rec
    # `sceneId` breaks datetime ties. Two granules of the same pass share an
    # acquisition datetime; without the tie-break the order is the STAC API's
    # iteration order across windows, and this array is canonicalised into
    # `snapshotHash`. Must match `verification/stac.ts`.
    return sorted(drop_reprocessed(list(scenes.values())), key=lambda s: (s["datetime"], s["sceneId"]))
