"""STAC search against Earth Search (AWS Open Data) — REAL Tier 0 acquisition.

Sentinel-2 L2A Cloud-Optimized GeoTIFFs; no credentials required. Scene IDs
returned here are recorded in every result so a third party can re-run the
derivation.
"""

from __future__ import annotations

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
    epsg = p.get("proj:epsg")
    if epsg is None and isinstance(p.get("proj:code"), str):
        epsg = int(p["proj:code"].replace("EPSG:", ""))
    return {
        "sceneId": item.id,
        "datetime": str(p.get("datetime")),
        "platform": str(p.get("platform", "")),
        "cloudCoverPct": float(p.get("eo:cloud_cover")),
        "processingBaseline": str(p.get("s2:processing_baseline", "")),
        "epsg": int(epsg or 0),
        "assets": {"red": red.href, "nir": nir.href, "scl": scl.href},
        "stacAdvertisedReflectance": {"scale": band.get("scale", 0.0001), "offset": band.get("offset", 0)},
    }


def search_sentinel2(bbox: tuple[float, float, float, float], windows: list[dict[str, Any]], max_cloud_cover_pct: float) -> list[dict[str, Any]]:
    client = Client.open(EARTH_SEARCH_URL)
    scenes: dict[str, dict[str, Any]] = {}
    for w in windows:
        search = client.search(
            collections=[S2_L2A_COLLECTION],
            bbox=list(bbox),
            datetime=f"{w['start']}T00:00:00Z/{w['end']}T23:59:59Z",
            query={"eo:cloud_cover": {"lt": max_cloud_cover_pct}},
            limit=100,
        )
        for item in search.items():
            rec = _scene_record(item)
            if rec is not None:
                scenes[rec["sceneId"]] = rec
    return sorted(scenes.values(), key=lambda s: s["datetime"])
