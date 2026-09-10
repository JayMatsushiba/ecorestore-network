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

from ecorestore_analysis.acquire import choose_tile, observe_scene, spread_limit
from ecorestore_analysis.cog import CogWindowRead
from ecorestore_analysis.geometry import FrameUnit, PixelGrid, acquisition_bbox_utm, build_sampling_frame, polygon_area_ha, utm_epsg_for
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
    units = build_sampling_frame(parcel["geometry"], plan, grid, 32611)
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


def test_utm_zone_follows_the_parcel():
    assert utm_epsg_for(-116.575, 49.129) == 32611  # Creston Valley, BC
    assert utm_epsg_for(-122.30, 41.98) == 32610  # Copco Lake, CA
    assert utm_epsg_for(-123.60, 47.97) == 32610  # Elwha, WA
    assert utm_epsg_for(5.37, 52.55) == 32631  # Marker Wadden, NL
    assert utm_epsg_for(147.3, -42.9) == 32755  # Tasmania: southern hemisphere
    assert utm_epsg_for(179.99, 0.0) == 32660 and utm_epsg_for(-179.99, 0.0) == 32601


def test_acquisition_bbox_is_in_the_given_zone(plan):
    # A square around Copco Lake. In zone 10 its easting sits near 558 km; the old
    # fixed zone 11 put the same ground at a meaningless easting west of the zone.
    lng, lat = -122.30, 41.98
    square = {"type": "Polygon", "coordinates": [[[lng - 0.01, lat - 0.01], [lng + 0.01, lat - 0.01], [lng + 0.01, lat + 0.01], [lng - 0.01, lat + 0.01], [lng - 0.01, lat - 0.01]]]}
    min_x, min_y, max_x, max_y = acquisition_bbox_utm(square, plan, 32610)
    assert 555_000 < min_x < max_x < 562_000
    assert 4_645_000 < min_y < max_y < 4_651_000
    pad = plan["controlRule"]["farRing"]["outerM"] + 100
    assert max_x - min_x == pytest.approx(2 * pad + 1_660, abs=60)


def test_frame_in_another_zone_has_the_same_shape(plan):
    """The frame builder is zone-agnostic: a parcel in zone 10 on a zone-10 grid yields
    a parcel unit whose pixel count matches its area at 10 m."""
    lng, lat = -122.30, 41.98
    square = {"type": "Polygon", "coordinates": [[[lng - 0.003, lat - 0.002], [lng + 0.003, lat - 0.002], [lng + 0.003, lat + 0.002], [lng - 0.003, lat + 0.002], [lng - 0.003, lat - 0.002]]]}
    min_x, min_y, max_x, max_y = acquisition_bbox_utm(square, plan, 32610)
    grid = PixelGrid(np.floor(min_x / 10) * 10, np.ceil(max_y / 10) * 10, 10.0, int((max_x - min_x) / 10) + 2, int((max_y - min_y) / 10) + 2)
    units = build_sampling_frame(square, plan, grid, 32610)
    parcel_unit = units[0]
    assert parcel_unit.unit_id == "parcel"
    assert parcel_unit.pixel_count * 0.01 == pytest.approx(parcel_unit.area_ha, rel=0.03)
    assert {u.zone for u in units} == {"parcel", "parcel_cell", "near", "far"}


def _scene(scene_id: str, datetime: str) -> dict:
    return {"sceneId": scene_id, "datetime": datetime}


def test_choose_tile_takes_the_tile_with_most_scenes_not_the_first():
    scenes = [
        _scene("S2A_10TFM_20230601_0_L2A", "2023-06-01T19:00:00Z"),
        _scene("S2A_10TEM_20230603_0_L2A", "2023-06-03T19:00:00Z"),
        _scene("S2B_10TEM_20230608_0_L2A", "2023-06-08T19:00:00Z"),
        _scene("S2B_10TFM_20230610_0_L2A", "2023-06-10T19:00:00Z"),
        _scene("S2A_10TEM_20230613_0_L2A", "2023-06-13T19:00:00Z"),
    ]
    tile, kept, dropped = choose_tile(scenes)
    assert tile == "10TEM"
    assert [s["sceneId"] for s in kept] == ["S2A_10TEM_20230603_0_L2A", "S2B_10TEM_20230608_0_L2A", "S2A_10TEM_20230613_0_L2A"]
    assert len(dropped) == 2


def test_choose_tile_breaks_ties_deterministically():
    scenes = [_scene("S2A_10TFM_20230601_0_L2A", "2023-06-01T19:00:00Z"), _scene("S2A_10TEM_20230603_0_L2A", "2023-06-03T19:00:00Z")]
    assert choose_tile(scenes)[0] == "10TEM"
    assert choose_tile(list(reversed(scenes)))[0] == "10TEM"


def test_spread_limit_touches_every_window(plan):
    windows = [*plan["windows"]["pre"], *plan["windows"]["post"]]  # 2023, 2024, 2025 seasons
    scenes = [_scene(f"S2A_11UNQ_{y}0{m}05_0_L2A", f"{y}-0{m}-05T18:50:00Z") for y in (2023, 2024, 2025) for m in (6, 7, 8, 9)]
    chosen = spread_limit(scenes, windows, 5)
    assert [s["datetime"][:7] for s in chosen] == ["2023-06", "2023-07", "2024-06", "2024-07", "2025-06"]
    assert spread_limit(scenes, windows, 100) == scenes
    assert spread_limit(scenes, windows, 0) == []
