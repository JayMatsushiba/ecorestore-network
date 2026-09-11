"""Scene selection rules that never touch the network."""

from ecorestore_analysis.stac import _scene_record, drop_reprocessed, epsg_from_tile, mgrs_tile


class _Asset:
    def __init__(self, href: str):
        self.href = href
        self.extra_fields = {"raster:bands": [{"scale": 0.0001, "offset": -0.1}]}


class _Item:
    def __init__(self, item_id: str, properties: dict, assets=("red", "nir", "scl")):
        self.id = item_id
        self.properties = properties
        self.assets = {k: _Asset(f"https://example/{item_id}/{k}.tif") for k in assets}


def test_scene_record_reads_the_fields_it_commits_to():
    rec = _scene_record(_Item("S2A_10TEM_20230721_0_L2A", {"datetime": "2023-07-21T19:03:00Z", "platform": "sentinel-2a", "eo:cloud_cover": 0.5, "s2:processing_baseline": "05.09", "proj:code": "EPSG:32610"}))
    assert rec["epsg"] == 32610 and rec["cloudCoverPct"] == 0.5 and rec["processingBaseline"] == "05.09"
    assert rec["stacAdvertisedReflectance"] == {"scale": 0.0001, "offset": -0.1}


def test_scene_record_tolerates_an_odd_proj_code():
    base = {"datetime": "2023-07-21T19:03:00Z", "eo:cloud_cover": 1.0}
    assert _scene_record(_Item("x", {**base, "proj:code": "epsg:32610"}))["epsg"] == 32610
    assert _scene_record(_Item("x", {**base, "proj:code": "urn:ogc:def:crs:OGC:1.3:CRS84"}))["epsg"] == 0
    assert _scene_record(_Item("x", {**base, "proj:epsg": 32611, "proj:code": "garbage"}))["epsg"] == 32611


def test_epsg_from_tile():
    assert epsg_from_tile("10TEM") == 32610
    assert epsg_from_tile("11UNQ") == 32611
    assert epsg_from_tile("55GEN") == 32755  # Tasmania: band G is south
    assert epsg_from_tile("31UFT") == 32631
    assert epsg_from_tile("not-a-tile") == 0 and epsg_from_tile("61TEM") == 0


def test_scene_record_skips_items_it_cannot_filter_or_place():
    assert _scene_record(_Item("x", {"datetime": "2023-07-21T19:03:00Z"})) is None  # no cloud cover
    assert _scene_record(_Item("x", {"eo:cloud_cover": 1.0})) is None  # no datetime
    assert _scene_record(_Item("x", {"datetime": "2023-07-21T19:03:00Z", "eo:cloud_cover": 1.0}, assets=("red", "nir"))) is None  # no SCL


def scene(scene_id: str, datetime: str, platform: str, baseline: str) -> dict:
    return {"sceneId": scene_id, "datetime": datetime, "platform": platform, "processingBaseline": baseline}


def test_mgrs_tile_from_earth_search_id():
    assert mgrs_tile("S2A_10TEM_20230721_0_L2A") == "10TEM"
    assert mgrs_tile("S2B_11UNQ_20240724_0_L2A") == "11UNQ"


def test_reprocessing_keeps_only_the_highest_baseline():
    # Lake Mills, summer 2018: the same S2A pass published under baseline 00.01 and 05.00.
    old = scene("S2A_10UDU_20180720_0_L2A", "2018-07-20T19:15:44.103000Z", "sentinel-2a", "00.01")
    new = scene("S2A_10UDU_20180720_1_L2A", "2018-07-20T19:21:14.139000Z", "sentinel-2a", "05.00")
    assert drop_reprocessed([old, new]) == [new]
    assert drop_reprocessed([new, old]) == [new]


def test_adjacent_orbits_on_one_day_are_both_kept():
    # Kootenay fixture, 2025-06-19: S2B at 18:50 and S2A at 19:00 are two observations.
    a = scene("S2B_11UNQ_20250619_0_L2A", "2025-06-19T18:50:47.105000Z", "sentinel-2b", "05.11")
    b = scene("S2A_11UNQ_20250619_1_L2A", "2025-06-19T19:00:56.171000Z", "sentinel-2a", "05.11")
    assert drop_reprocessed([a, b]) == [a, b]


def test_split_granules_of_one_datatake_are_both_kept():
    # Kootenay fixture, 2023-08-14: two granules of one S2A pass, 1.3 s apart, same baseline.
    a = scene("S2A_11UNQ_20230814_1_L2A", "2023-08-14T18:50:52.022000Z", "sentinel-2a", "05.09")
    b = scene("S2A_11UNQ_20230814_0_L2A", "2023-08-14T18:50:53.371000Z", "sentinel-2a", "05.09")
    assert drop_reprocessed([a, b]) == [a, b]


def test_other_tiles_and_days_are_untouched():
    scenes = [
        scene("S2A_10TEM_20230721_0_L2A", "2023-07-21T19:03:00Z", "sentinel-2a", "05.09"),
        scene("S2A_10TFM_20230721_0_L2A", "2023-07-21T19:03:00Z", "sentinel-2a", "05.09"),
        scene("S2A_10TEM_20230726_0_L2A", "2023-07-26T19:03:00Z", "sentinel-2a", "05.09"),
    ]
    assert drop_reprocessed(scenes) == scenes
