"""Acquisition geometry and per-scene observation.

The parcel and parcel-cell pixel masks must equal the ones in the committed
REAL snapshot (same H3 core, same projection, same point-in-polygon rule);
ring units are allowed to differ because the ring buffers are built
differently (see geometry.py).
"""

import gzip
import json
from pathlib import Path

import numpy as np
import pytest

from ecorestore_analysis.acquire import observe_scene
from ecorestore_analysis.cog import CogWindowRead
from ecorestore_analysis.geometry import FrameUnit, PixelGrid, build_sampling_frame, polygon_area_ha
from shapely.geometry import shape

REFERENCE = Path(__file__).parent / "reference"
FIXTURES = Path(__file__).resolve().parents[2] / "verification" / "fixtures"


def _load_real_snapshot() -> dict:
    req = json.loads((REFERENCE / "real.request.json").read_text())
    with gzip.open(REFERENCE / req["tier0CanonicalFile"], "rb") as f:
        return json.loads(f.read().decode())


@pytest.fixture(scope="module")
def plan() -> dict:
    return json.loads((FIXTURES / "analysis-plan.json").read_text())


@pytest.fixture(scope="module")
def parcel() -> dict:
    return json.loads((FIXTURES / "kootenay-parcel.json").read_text())


def _band(width: int, height: int, res: float, fill, dtype=np.uint16) -> CogWindowRead:
    idx = np.arange(width * height).reshape(height, width)
    data = np.broadcast_to(np.asarray(fill(idx)), (height, width)).astype(dtype)
    return CogWindowRead(data, PixelGrid(500_000, 5_440_000, res, width, height))


def _unit(uid: str, zone: str, pixels: list[int]) -> FrameUnit:
    return FrameUnit(uid, zone, 0.02, len(pixels), (0.0, 0.0), np.asarray(pixels, dtype=np.uint32))


def test_observe_scene_masks_clouds_via_scl(plan):
    red = _band(4, 4, 10, lambda i: 400)
    nir = _band(4, 4, 10, lambda i: 3600)
    scl = _band(2, 2, 20, lambda i: np.where(i % 2 == 0, 4, 9), np.uint8)
    units = [_unit("left", "parcel", [0, 1, 4, 5, 8, 9, 12, 13]), _unit("right", "parcel", [2, 3, 6, 7, 10, 11, 14, 15])]
    obs = observe_scene(red, nir, scl, units, plan)
    assert obs["ndvi"][0] == pytest.approx((0.36 - 0.04) / (0.36 + 0.04), abs=1e-3)
    assert obs["validFraction"][0] == 1
    assert obs["ndvi"][1] is None
    assert obs["validFraction"][1] == 0


def test_observe_scene_water_and_nodata(plan):
    red = _band(4, 4, 10, lambda i: 400)
    nir = _band(4, 4, 10, lambda i: 300)
    scl = _band(2, 2, 20, lambda i: 6, np.uint8)
    obs = observe_scene(red, nir, scl, [_unit("u", "far", list(range(16)))], plan)
    assert obs["waterFraction"][0] == 1
    assert obs["ndvi"][0] < 0
    zero = _band(2, 2, 10, lambda i: 0)
    obs = observe_scene(zero, zero, _band(1, 1, 20, lambda i: 4, np.uint8), [_unit("u", "far", [0, 1, 2, 3])], plan)
    assert obs["ndvi"][0] is None
    assert obs["validFraction"][0] == 0


def test_frame_parcel_and_cells_match_committed_snapshot(plan, parcel):
    snap = _load_real_snapshot()
    bbox = snap["window"]["bbox"]
    _, _, w, h = snap["window"]["pixelWindow"]
    # The 1.0.0 snapshot records the requested bbox; the read window snaps outward to
    # whole 10 m pixels of the tile grid (Sentinel-2 tile origins sit on a 60 m lattice).
    grid = PixelGrid(np.floor(bbox[0] / 10) * 10, np.ceil(bbox[3] / 10) * 10, 10.0, w, h)
    units = build_sampling_frame(parcel["geometry"], plan, grid)
    by_id = {u.unit_id: u for u in units}
    ref = {u["unitId"]: u for u in snap["units"]}

    assert by_id["parcel"].pixel_count == ref["parcel"]["pixelCount"]
    ref_cells = {k for k, u in ref.items() if u["zone"] == "parcel_cell"}
    py_cells = {u.unit_id for u in units if u.zone == "parcel_cell"}
    assert py_cells == ref_cells
    for cell in ref_cells:
        assert by_id[cell].pixel_count == ref[cell]["pixelCount"], cell

    # Ring candidates: same order of magnitude, different buffer construction.
    for zone in ("near", "far"):
        n_ref = sum(1 for u in ref.values() if u["zone"] == zone)
        n_py = sum(1 for u in units if u.zone == zone)
        assert abs(n_py - n_ref) / n_ref < 0.1, (zone, n_py, n_ref)


def test_area_is_geodesic_not_cell_count(parcel):
    ha = polygon_area_ha(shape(parcel["geometry"]))
    assert ha == pytest.approx(48.95, abs=0.2)  # turf (sphere) gave 48.9486; the ellipsoid differs slightly
