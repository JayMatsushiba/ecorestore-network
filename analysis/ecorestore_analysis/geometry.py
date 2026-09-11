"""Sampling geometry for Tier 0 acquisition (``frame.ts`` / ``geometry.ts``).

H3 is the index and join key; polygon geometry carries quantities. Areas are
geodesic (WGS84 ellipsoid via pyproj); the TypeScript graph used turf's
spherical area, so hectare figures differ by the sphere/ellipsoid ratio
(~0.1–0.3 % at this latitude) — one reason this is processing graph 2.x.

Rings are built in the projected plane with shapely (annulus =
buffer(outer) − buffer(inner)), where the TypeScript graph used turf's
geodesic buffer. Candidate control units at ring edges may therefore differ
between the graphs; parcel and parcel-cell pixel masks are identical, because
both projects use the same H3 core and the same point-in-polygon rule.

The projected plane is the UTM zone of the Sentinel-2 tile being read, given
as an EPSG code by the caller. The TypeScript graph fixes zone 11N; this one
takes the zone from the data, so a parcel anywhere gets the right grid.

No hashes are computed here. ``geometryHash``, ``h3Root`` and
``snapshotHash`` are attached by ``scripts/finalize-acquisition.ts`` — the
one canonicaliser.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Iterable

import h3
import numpy as np
from pyproj import Geod, Transformer
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform as shp_transform

WGS84 = "EPSG:4326"

_geod = Geod(ellps="WGS84")


def utm_epsg_for(lng: float, lat: float) -> int:
    """EPSG code of the WGS84 UTM zone containing a point (326xx north, 327xx south)."""
    zone = int(math.floor((lng + 180) / 6)) % 60 + 1
    return (32600 if lat >= 0 else 32700) + zone


@lru_cache(maxsize=8)
def _transformers(epsg: int) -> tuple[Transformer, Transformer]:
    return (
        Transformer.from_crs(WGS84, f"EPSG:{epsg}", always_xy=True),
        Transformer.from_crs(f"EPSG:{epsg}", WGS84, always_xy=True),
    )


def project_to_utm(lng: float, lat: float, epsg: int) -> tuple[float, float]:
    return _transformers(epsg)[0].transform(lng, lat)


def unproject_from_utm(x: float, y: float, epsg: int) -> tuple[float, float]:
    return _transformers(epsg)[1].transform(x, y)


def polygon_area_ha(geom: Polygon | MultiPolygon) -> float:
    """Geodesic area on the WGS84 ellipsoid, hectares."""
    area, _ = _geod.geometry_area_perimeter(geom)
    return abs(area) / 10_000


def cells_for_geometry(geom: Polygon | MultiPolygon, resolution: int) -> list[str]:
    """H3 cells whose centre lies inside the (lng, lat) geometry, holes respected."""
    return sorted(h3.geo_to_cells(mapping(geom), resolution))


def cell_polygon(cell: str) -> Polygon:
    ring = [(lng, lat) for lat, lng in h3.cell_to_boundary(cell)]
    return Polygon(ring)


def cell_centroid_lnglat(cell: str) -> tuple[float, float]:
    lat, lng = h3.cell_to_latlng(cell)
    return (lng, lat)


def ring_polygon(parcel: Polygon, inner_m: float, outer_m: float, epsg: int) -> Polygon | MultiPolygon:
    """Annulus between inner_m and outer_m around the parcel, in lng/lat."""
    to_utm, to_wgs = _transformers(epsg)
    utm = shp_transform(to_utm.transform, parcel)
    outer = utm.buffer(outer_m)
    inner = utm.buffer(inner_m) if inner_m > 0 else utm
    annulus = outer.difference(inner)
    return shp_transform(to_wgs.transform, annulus)


@dataclass(frozen=True)
class PixelGrid:
    origin_x: float  # UTM x of the left edge of the first column
    origin_y: float  # UTM y of the top edge of the first row
    resolution: float
    width: int
    height: int

    def to_dict(self) -> dict[str, Any]:
        return {"originX": self.origin_x, "originY": self.origin_y, "resolution": self.resolution, "width": self.width, "height": self.height}


def _even_odd_mask(xs: np.ndarray, ys: np.ndarray, ring: np.ndarray) -> np.ndarray:
    """Vectorised even-odd point-in-ring test, the same rule as ``pointInRing``."""
    inside = np.zeros(xs.shape, dtype=bool)
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if yi != yj:
            cross = ((yi > ys) != (yj > ys)) & (xs < ((xj - xi) * (ys - yi)) / (yj - yi) + xi)
            inside ^= cross
        j = i
    return inside


def pixel_mask(grid: PixelGrid, projected_rings: list[np.ndarray]) -> np.ndarray:
    """Row-major indices of pixels whose centres fall inside the outer ring and outside holes."""
    outer = projected_rings[0]
    holes = projected_rings[1:]
    min_x, min_y = outer.min(axis=0)
    max_x, max_y = outer.max(axis=0)
    c0 = max(0, int(np.floor((min_x - grid.origin_x) / grid.resolution)))
    c1 = min(grid.width - 1, int(np.ceil((max_x - grid.origin_x) / grid.resolution)))
    r0 = max(0, int(np.floor((grid.origin_y - max_y) / grid.resolution)))
    r1 = min(grid.height - 1, int(np.ceil((grid.origin_y - min_y) / grid.resolution)))
    if c1 < c0 or r1 < r0:
        return np.zeros(0, dtype=np.uint32)
    rows = np.arange(r0, r1 + 1)
    cols = np.arange(c0, c1 + 1)
    ys = grid.origin_y - (rows + 0.5) * grid.resolution
    xs = grid.origin_x + (cols + 0.5) * grid.resolution
    X, Y = np.meshgrid(xs, ys)
    inside = _even_odd_mask(X, Y, outer)
    for h in holes:
        inside &= ~_even_odd_mask(X, Y, h)
    R, C = np.meshgrid(rows, cols, indexing="ij")
    return (R[inside] * grid.width + C[inside]).astype(np.uint32)


def project_rings(geom: Polygon, epsg: int) -> list[np.ndarray]:
    to_utm = _transformers(epsg)[0]
    rings = [geom.exterior, *geom.interiors]
    out = []
    for ring in rings:
        coords = np.asarray(ring.coords, dtype=np.float64)
        x, y = to_utm.transform(coords[:, 0], coords[:, 1])
        out.append(np.column_stack([x, y]))
    return out


def mask_of_geometry(grid: PixelGrid, geom: Polygon | MultiPolygon, epsg: int) -> np.ndarray:
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    acc: set[int] = set()
    for poly in polys:
        acc.update(int(i) for i in pixel_mask(grid, project_rings(poly, epsg)))
    return np.asarray(sorted(acc), dtype=np.uint32)


@dataclass
class FrameUnit:
    unit_id: str
    zone: str
    area_ha: float
    pixel_count: int
    centroid: tuple[float, float]
    pixels: np.ndarray

    def to_dict(self) -> dict[str, Any]:
        return {"unitId": self.unit_id, "zone": self.zone, "areaHa": self.area_ha, "pixelCount": self.pixel_count, "centroid": [self.centroid[0], self.centroid[1]]}


def acquisition_bbox_utm(parcel_geojson: dict[str, Any], plan: dict[str, Any], epsg: int, margin_m: float = 100) -> tuple[float, float, float, float]:
    """UTM bbox of the parcel expanded to cover the far ring plus a margin."""
    geom = shape(parcel_geojson)
    min_lng, min_lat, max_lng, max_lat = geom.bounds
    corners = [project_to_utm(lng, lat, epsg) for lng, lat in ((min_lng, min_lat), (max_lng, min_lat), (max_lng, max_lat), (min_lng, max_lat))]
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    pad = plan["controlRule"]["farRing"]["outerM"] + margin_m
    return (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)


def _unit_for(cell: str, zone: str, geom: Polygon, px: np.ndarray) -> FrameUnit:
    return FrameUnit(cell, zone, polygon_area_ha(geom), int(len(px)), cell_centroid_lnglat(cell), px)


def _intersect(a: np.ndarray, b: set[int]) -> np.ndarray:
    return np.asarray([v for v in a if int(v) in b], dtype=np.uint32)


def build_sampling_frame(parcel_geojson: dict[str, Any], plan: dict[str, Any], grid: PixelGrid, epsg: int) -> list[FrameUnit]:
    """Parcel, parcel cells and ring units with pixel masks on ``grid``, which is in ``epsg``."""
    parcel = shape(parcel_geojson)
    if not isinstance(parcel, Polygon):
        raise ValueError("parcel geometry must be a Polygon")
    units: list[FrameUnit] = []
    parcel_px = mask_of_geometry(grid, parcel, epsg)
    parcel_set = {int(i) for i in parcel_px}
    ring = list(parcel.exterior.coords)  # closed ring, as in the GeoJSON — the reference averages all vertices
    centroid = (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))
    units.append(FrameUnit("parcel", "parcel", polygon_area_ha(parcel), int(len(parcel_px)), centroid, parcel_px))

    for cell in cells_for_geometry(parcel, plan["controlRule"]["parcelCellResolution"]):
        geom = cell_polygon(cell)
        px = _intersect(mask_of_geometry(grid, geom, epsg), parcel_set)
        if len(px) == 0:
            continue
        units.append(_unit_for(cell, "parcel_cell", geom, px))

    rings: Iterable[tuple[str, Polygon | MultiPolygon]] = [
        ("near", ring_polygon(parcel, plan["controlRule"]["nearRing"]["innerM"], plan["controlRule"]["nearRing"]["outerM"], epsg)),
        ("far", ring_polygon(parcel, plan["controlRule"]["farRing"]["innerM"], plan["controlRule"]["farRing"]["outerM"], epsg)),
    ]
    for zone, geom in rings:
        ring_set = {int(i) for i in mask_of_geometry(grid, geom, epsg)}
        for cell in cells_for_geometry(geom, plan["controlRule"]["unitResolution"]):
            cell_geom = cell_polygon(cell)
            px = _intersect(mask_of_geometry(grid, cell_geom, epsg), ring_set)
            if len(px) == 0:
                continue
            units.append(_unit_for(cell, zone, cell_geom, px))
    return units
