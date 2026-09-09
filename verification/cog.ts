/**
 * Windowed reads of Cloud-Optimized GeoTIFFs over HTTP range requests, with an
 * on-disk cache so acquisition can be re-run without re-downloading.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromUrl } from 'geotiff';
import type { PixelGrid } from './geometry.js';

export interface CogWindowRead {
  data: Uint16Array | Uint8Array;
  width: number;
  height: number;
  grid: PixelGrid;
}

export interface CogReadOptions {
  /** Target UTM bbox [minX, minY, maxX, maxY]; the read window snaps outward to whole pixels. */
  bboxUtm: [number, number, number, number];
  cacheDir?: string;
}

export async function readCogWindow(url: string, opts: CogReadOptions): Promise<CogWindowRead> {
  const cacheKey = createHash('sha256').update(`${url}|${opts.bboxUtm.join(',')}`).digest('hex');
  const cachePath = opts.cacheDir ? join(opts.cacheDir, `${cacheKey}.json`) : undefined;
  if (cachePath && existsSync(cachePath)) {
    const c = JSON.parse(readFileSync(cachePath, 'utf8')) as { data: number[]; width: number; height: number; grid: PixelGrid; bytes: 1 | 2 };
    return { data: c.bytes === 1 ? Uint8Array.from(c.data) : Uint16Array.from(c.data), width: c.width, height: c.height, grid: c.grid };
  }
  const tiff = await fromUrl(url);
  const image = await tiff.getImage();
  const origin = image.getOrigin();
  const resolution = image.getResolution();
  const ox = origin[0]!;
  const oy = origin[1]!;
  const res = Math.abs(resolution[0]!);
  if (Math.abs(Math.abs(resolution[1]!) - res) > 1e-9) throw new Error('non-square pixels not supported');
  const [minX, minY, maxX, maxY] = opts.bboxUtm;
  const c0 = Math.max(0, Math.floor((minX - ox) / res));
  const c1 = Math.min(image.getWidth(), Math.ceil((maxX - ox) / res));
  const r0 = Math.max(0, Math.floor((oy - maxY) / res));
  const r1 = Math.min(image.getHeight(), Math.ceil((oy - minY) / res));
  const rasters = await image.readRasters({ window: [c0, r0, c1, r1] });
  const band = rasters[0] as Uint16Array | Uint8Array;
  const out: CogWindowRead = {
    data: band,
    width: rasters.width,
    height: rasters.height,
    grid: { originX: ox + c0 * res, originY: oy - r0 * res, resolution: res, width: rasters.width, height: rasters.height },
  };
  if (cachePath) {
    mkdirSync(opts.cacheDir!, { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ data: Array.from(band), width: out.width, height: out.height, grid: out.grid, bytes: band.BYTES_PER_ELEMENT }));
  }
  return out;
}
