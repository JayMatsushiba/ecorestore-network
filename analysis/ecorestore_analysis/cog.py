"""Windowed reads of Cloud-Optimized GeoTIFFs through rasterio/GDAL, with an
on-disk cache so acquisition can be re-run without re-downloading.

The read window snaps outward to whole pixels from a UTM bbox, exactly as
``cog.ts`` does, so both graphs sample the same grid.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

from .geometry import PixelGrid

GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF",
    "GDAL_HTTP_MULTIRANGE": "YES",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "VSI_CACHE": "TRUE",
    "AWS_NO_SIGN_REQUEST": "YES",
}


@dataclass
class CogWindowRead:
    data: np.ndarray  # 2-D uint16 or uint8, row-major
    grid: PixelGrid

    @property
    def width(self) -> int:
        return self.grid.width

    @property
    def height(self) -> int:
        return self.grid.height


def _cache_path(cache_dir: Path | None, url: str, bbox: tuple[float, float, float, float]) -> Path | None:
    if cache_dir is None:
        return None
    key = hashlib.sha256(f"{url}|{','.join(str(v) for v in bbox)}".encode()).hexdigest()
    return cache_dir / f"{key}.npz"


def read_cog_window(url: str, bbox_utm: tuple[float, float, float, float], cache_dir: Path | None = None) -> CogWindowRead:
    cp = _cache_path(cache_dir, url, bbox_utm)
    if cp is not None and cp.exists():
        z = np.load(cp)
        g = z["grid"]
        return CogWindowRead(z["data"], PixelGrid(float(g[0]), float(g[1]), float(g[2]), int(g[3]), int(g[4])))
    with rasterio.Env(**GDAL_ENV), rasterio.open(url) as src:
        t = src.transform
        ox, oy = t.c, t.f
        res = abs(t.a)
        if abs(abs(t.e) - res) > 1e-9:
            raise ValueError("non-square pixels not supported")
        min_x, min_y, max_x, max_y = bbox_utm
        c0 = max(0, int(np.floor((min_x - ox) / res)))
        c1 = min(src.width, int(np.ceil((max_x - ox) / res)))
        r0 = max(0, int(np.floor((oy - max_y) / res)))
        r1 = min(src.height, int(np.ceil((oy - min_y) / res)))
        data = src.read(1, window=Window(c0, r0, c1 - c0, r1 - r0))
    grid = PixelGrid(ox + c0 * res, oy - r0 * res, res, int(data.shape[1]), int(data.shape[0]))
    if cp is not None:
        cp.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(cp, data=data, grid=np.array([grid.origin_x, grid.origin_y, grid.resolution, grid.width, grid.height], dtype=np.float64))
    return CogWindowRead(data, grid)


def default_cache_dir() -> Path | None:
    v = os.environ.get("ACQUIRE_CACHE_DIR")
    return Path(v) if v else None
