"""REAL Tier 0 acquisition — the batch job (processing graph 2.0.0).

Searches Earth Search for Sentinel-2 L2A scenes over the parcel for every
pre-registered window, reads the red, NIR and SCL bands over the sampling
frame through rasterio, masks by SCL class, computes per-unit NDVI and writes
an **unhashed** snapshot:

    <out>/tier0-<parcelId>.unhashed.json

It is the same document as ``verification/fixtures/tier0-<parcelId>.json``
minus ``geometryHash``, ``h3Root`` and ``snapshotHash``. Those are attached
by ``npm run acquire:finalize`` — the TypeScript canonicaliser — which then
writes the fixture. Python produces observations; it commits nothing.

    ecorestore-acquire --out ./out/acquire --limit 5
    ecorestore-acquire --fixtures ../verification/fixtures --out ./out/acquire
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from . import PROCESSING_GRAPH_VERSION
from .cog import CogWindowRead, read_cog_window
from .geometry import FrameUnit, PixelGrid, acquisition_bbox_utm, build_sampling_frame, utm_epsg_for
from .jsnum import round4
from .stac import ASSET_HOST, EARTH_SEARCH_URL, S2_L2A_COLLECTION, search_sentinel2


def observe_scene(red: CogWindowRead, nir: CogWindowRead, scl: CogWindowRead, units: list[FrameUnit], plan: dict[str, Any]) -> dict[str, list]:
    """Per-unit NDVI statistics for one scene (``observeScene`` in ``acquire.ts``)."""
    if red.width != nir.width or red.height != nir.height:
        raise ValueError("red/nir window mismatch")
    valid_classes = np.asarray(plan["index"]["sclClassesValid"])
    scale = plan["index"]["dnToReflectance"]["scale"]
    offset = plan["index"]["dnToReflectance"]["offset"]
    g = red.grid
    rows = np.arange(red.height)
    cols = np.arange(red.width)
    y = g.origin_y - (rows + 0.5) * g.resolution
    x = g.origin_x + (cols + 0.5) * g.resolution
    sr = np.floor((scl.grid.origin_y - y) / scl.grid.resolution).astype(np.int64)
    sc = np.floor((x - scl.grid.origin_x) / scl.grid.resolution).astype(np.int64)
    SR, SC = np.meshgrid(sr, sc, indexing="ij")
    in_range = (SR >= 0) & (SR < scl.height) & (SC >= 0) & (SC < scl.width)
    scl_val = np.zeros((red.height, red.width), dtype=np.int64)
    scl_val[in_range] = scl.data[SR[in_range], SC[in_range]]

    dn_r = red.data.astype(np.float64)
    dn_n = nir.data.astype(np.float64)
    valid = (dn_r != 0) & (dn_n != 0) & np.isin(scl_val, valid_classes)
    rr = dn_r * scale + offset
    nn = dn_n * scale + offset
    denom = nn + rr
    with np.errstate(divide="ignore", invalid="ignore"):
        v = np.where(denom > 0, (nn - rr) / denom, np.nan)
    valid &= denom > 0
    valid &= (v >= -1) & (v <= 1)
    # The reference stores NDVI in a Float32Array and accumulates in float64.
    ndvi = np.where(valid, v, 0.0).astype(np.float32).astype(np.float64).ravel()
    valid_flat = valid.ravel()
    water_flat = (valid & (scl_val == 6)).ravel()

    out: dict[str, list] = {"ndvi": [], "validFraction": [], "waterFraction": []}
    min_valid = plan["index"]["minValidPixelFraction"]
    for u in units:
        px = u.pixels
        vmask = valid_flat[px]
        n = int(vmask.sum())
        s = float(ndvi[px][vmask].sum())
        w = int(water_flat[px].sum())
        vf = n / len(px) if len(px) > 0 else 0.0
        out["validFraction"].append(round4(vf))
        out["waterFraction"].append(round4(w / n) if n > 0 else 0)
        out["ndvi"].append(round4(s / n) if vf >= min_valid and n > 0 else None)
    return out


def load_fixture(fixtures: Path, name: str) -> dict[str, Any]:
    return json.loads((fixtures / name).read_text())


def acquire(fixtures: Path, out_dir: Path, cache_dir: Path | None, limit: int | None, concurrency: int, log=print) -> Path:
    parcel = load_fixture(fixtures, "kootenay-parcel.json")
    plan = load_fixture(fixtures, "analysis-plan.json")
    ring = parcel["geometry"]["coordinates"][0]
    lngs = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    bbox = (min(lngs), min(lats), max(lngs), max(lats))

    scenes = search_sentinel2(bbox, [*plan["windows"]["pre"], *plan["windows"]["post"]], plan["index"]["maxSceneCloudCoverPct"])
    if limit:
        scenes = scenes[:limit]
    log(f"STAC: {len(scenes)} Sentinel-2 L2A scenes under {plan['index']['maxSceneCloudCoverPct']}% cloud")
    if not scenes:
        raise SystemExit("no scenes found")

    # The frame is built in the UTM zone of the tile being read. The first scene
    # defines the grid, so its zone defines the frame; a scene from another zone
    # can never share the grid and is skipped before any band is downloaded.
    epsg = scenes[0]["epsg"] or utm_epsg_for((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
    bbox_utm = acquisition_bbox_utm(parcel["geometry"], plan, epsg)
    log(f"parcel {parcel['parcelId']}: EPSG:{epsg}, acquisition bbox {tuple(round(v, 1) for v in bbox_utm)}")

    def read_bands(scene: dict[str, Any]) -> tuple[CogWindowRead, CogWindowRead, CogWindowRead]:
        a = scene["assets"]
        return (read_cog_window(a["red"], bbox_utm, cache_dir), read_cog_window(a["nir"], bbox_utm, cache_dir), read_cog_window(a["scl"], bbox_utm, cache_dir))

    # First scene defines the grid; every other scene must match it (same MGRS tile).
    first = read_bands(scenes[0])
    grid: PixelGrid = first[0].grid
    units = build_sampling_frame(parcel["geometry"], plan, grid, epsg)
    counts = {z: sum(1 for u in units if u.zone == z) for z in ("parcel_cell", "near", "far")}
    log(f"frame: {len(units)} units ({counts['parcel_cell']} parcel cells, {counts['near']} near, {counts['far']} far) on a {grid.width}x{grid.height} px grid")

    observations: dict[str, Any] = {}
    kept: list[dict[str, Any]] = []

    def work(i_scene: tuple[int, dict[str, Any]]):
        i, scene = i_scene
        if scene["epsg"] and scene["epsg"] != epsg:
            log(f"  skip {scene['sceneId']}: EPSG:{scene['epsg']}, frame is EPSG:{epsg}")
            return None
        bands = first if i == 0 else read_bands(scene)
        g = bands[0].grid
        if (g.origin_x, g.origin_y, g.width, g.height) != (grid.origin_x, grid.origin_y, grid.width, grid.height):
            log(f"  skip {scene['sceneId']}: grid mismatch")
            return None
        obs = observe_scene(*bands, units, plan)
        log(f"  {scene['sceneId']} {scene['datetime'][:10]} cloud {scene['cloudCoverPct']:.1f}% parcel NDVI {obs['ndvi'][0] if obs['ndvi'][0] is not None else 'masked'} (valid {obs['validFraction'][0]})")
        return scene, obs

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        for r in pool.map(work, enumerate(scenes)):
            if r is None:
                continue
            scene, obs = r
            kept.append(scene)
            observations[scene["sceneId"]] = obs

    snapshot = {
        "provenance": "REAL",
        "tier": 0,
        "source": {"catalog": EARTH_SEARCH_URL, "collection": S2_L2A_COLLECTION, "assetHost": ASSET_HOST},
        "processingGraphVersion": PROCESSING_GRAPH_VERSION,
        "acquiredAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "parcelId": parcel["parcelId"],
        "crs": f"EPSG:{epsg}",
        "window": {"bbox": list(bbox_utm), "pixelWindow": [0, 0, grid.width, grid.height], "grid": grid.to_dict()},
        "scenes": kept,
        "units": [u.to_dict() for u in units],
        "observations": observations,
        # Handoff only — `scripts/finalize-acquisition.ts` verifies this against
        # the repository parcel before attaching `geometryHash` and `h3Root`,
        # then strips it. It is never part of the hashed document. Without it
        # finalize could bind a snapshot acquired from a different `--fixtures`
        # geometry to the repository parcel's identity on a matching id alone.
        "sourceParcel": {
            "parcelId": parcel["parcelId"],
            "geometry": parcel["geometry"],
            "h3Resolution": parcel["h3Resolution"],
        },
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"tier0-{parcel['parcelId']}.unhashed.json"
    out_path.write_text(json.dumps(snapshot, allow_nan=False))
    log(f"wrote {out_path} ({len(kept)} scenes, unhashed — run `npm run acquire:finalize -- {out_path}` to attach geometryHash, h3Root and snapshotHash)")
    return out_path


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description="REAL Tier 0 acquisition (processing graph 2.0.0)")
    ap.add_argument("--fixtures", default=None, help="directory holding kootenay-parcel.json and analysis-plan.json (default: /fixtures, else ../verification/fixtures)")
    ap.add_argument("--out", default=os.environ.get("ACQUIRE_OUT", "./out/acquire"), help="output directory (env ACQUIRE_OUT)")
    ap.add_argument("--cache", default=os.environ.get("ACQUIRE_CACHE_DIR"), help="COG window cache directory (env ACQUIRE_CACHE_DIR)")
    ap.add_argument("--limit", type=int, default=None, help="only the first N scenes (smoke test)")
    ap.add_argument("--concurrency", type=int, default=4)
    args = ap.parse_args(argv)
    fixtures = Path(args.fixtures) if args.fixtures else (Path("/fixtures") if Path("/fixtures").is_dir() else Path(__file__).resolve().parents[2] / "verification" / "fixtures")
    if not (fixtures / "analysis-plan.json").exists():
        sys.exit(f"fixtures not found at {fixtures}")
    t0 = time.perf_counter()
    acquire(fixtures, Path(args.out), Path(args.cache) if args.cache else None, args.limit, args.concurrency)
    print(f"done in {time.perf_counter() - t0:.1f} s")


if __name__ == "__main__":
    main()
