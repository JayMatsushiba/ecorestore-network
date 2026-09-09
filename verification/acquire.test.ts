import { describe, expect, it } from 'vitest';
import { observeScene } from './acquire.js';
import type { CogWindowRead } from './cog.js';
import type { FrameUnit } from './frame.js';
import { loadPlan } from './fixtures.js';
import type { SceneRecord } from './models.js';

function band(width: number, height: number, res: number, fill: (i: number) => number, bytes: 1 | 2 = 2): CogWindowRead {
  const n = width * height;
  const data = bytes === 1 ? new Uint8Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) data[i] = fill(i);
  return { data, width, height, grid: { originX: 500_000, originY: 5_440_000, resolution: res, width, height } };
}

const scene: SceneRecord = {
  sceneId: 'TEST_SCENE',
  datetime: '2024-07-01T18:00:00Z',
  platform: 'sentinel-2b',
  cloudCoverPct: 1,
  processingBaseline: '05.11',
  epsg: 32611,
  assets: { red: 'x', nir: 'x', scl: 'x' },
  stacAdvertisedReflectance: { scale: 0.0001, offset: -0.1 },
};

describe('observeScene', () => {
  const plan = loadPlan();

  it('computes NDVI over valid pixels and masks clouds via SCL', () => {
    // 4x4 grid at 10 m; SCL 2x2 at 20 m. Left half vegetation (SCL 4), right half cloud (SCL 9).
    const red = band(4, 4, 10, () => 400);
    const nir = band(4, 4, 10, () => 3600);
    const scl = band(2, 2, 20, (i) => (i % 2 === 0 ? 4 : 9), 1);
    const units: FrameUnit[] = [
      { unitId: 'left', zone: 'parcel', areaHa: 0.02, pixelCount: 8, centroid: [0, 0], pixels: Uint32Array.from([0, 1, 4, 5, 8, 9, 12, 13]) },
      { unitId: 'right', zone: 'parcel', areaHa: 0.02, pixelCount: 8, centroid: [0, 0], pixels: Uint32Array.from([2, 3, 6, 7, 10, 11, 14, 15]) },
    ];
    const obs = observeScene(scene, { red, nir, scl }, units, plan);
    expect(obs.ndvi[0]).toBeCloseTo((0.36 - 0.04) / (0.36 + 0.04), 3);
    expect(obs.validFraction[0]).toBe(1);
    expect(obs.ndvi[1]).toBeNull();
    expect(obs.validFraction[1]).toBe(0);
  });

  it('flags water fraction and applies the min valid fraction', () => {
    const red = band(4, 4, 10, () => 400);
    const nir = band(4, 4, 10, () => 300);
    const scl = band(2, 2, 20, () => 6, 1);
    const units: FrameUnit[] = [{ unitId: 'u', zone: 'far', areaHa: 0.16, pixelCount: 16, centroid: [0, 0], pixels: Uint32Array.from(Array.from({ length: 16 }, (_, i) => i)) }];
    const obs = observeScene(scene, { red, nir, scl }, units, plan);
    expect(obs.waterFraction[0]).toBe(1);
    expect(obs.ndvi[0]).toBeLessThan(0);
  });

  it('treats DN 0 as nodata', () => {
    const red = band(2, 2, 10, () => 0);
    const nir = band(2, 2, 10, () => 0);
    const scl = band(1, 1, 20, () => 4, 1);
    const units: FrameUnit[] = [{ unitId: 'u', zone: 'far', areaHa: 0.04, pixelCount: 4, centroid: [0, 0], pixels: Uint32Array.from([0, 1, 2, 3]) }];
    const obs = observeScene(scene, { red, nir, scl }, units, plan);
    expect(obs.ndvi[0]).toBeNull();
    expect(obs.validFraction[0]).toBe(0);
  });
});
