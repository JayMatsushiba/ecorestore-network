import { describe, expect, it } from 'vitest';
import { loadParcel, loadPlan } from './fixtures.js';
import { acquisitionBboxUtm } from './frame.js';
import { cellsForPolygon, parcelIdentity, pixelMask, pointInRing, polygonAreaHa, projectToUtm, ringPolygon, unprojectFromUtm } from './geometry.js';

describe('geometry', () => {
  const parcel = loadParcel();
  const plan = loadPlan();

  it('projects to UTM 11N and back', () => {
    const xy = projectToUtm([-116.575, 49.129]);
    expect(xy[0]).toBeGreaterThan(500_000);
    expect(xy[1]).toBeGreaterThan(5_400_000);
    const back = unprojectFromUtm(xy);
    expect(back[0]).toBeCloseTo(-116.575, 6);
    expect(back[1]).toBeCloseTo(49.129, 6);
  });

  it('parcel area comes from geodesic polygon area, not cell counts', () => {
    const id = parcelIdentity(parcel.parcelId, parcel.geometry, parcel.h3Resolution);
    expect(id.areaHa).toBeCloseTo(48.95, 1);
    expect(id.h3CellCount).toBeGreaterThan(20);
    // ~1.5 ha per r10 cell would give a different number; identity must not depend on it.
    expect(Math.abs(id.areaHa - id.h3CellCount * 1.5)).toBeGreaterThan(0.5);
    expect(id.geometryHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(id.h3Root).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('identity is stable and sensitive to geometry', () => {
    const a = parcelIdentity('p', parcel.geometry, 10);
    const b = parcelIdentity('p', parcel.geometry, 10);
    expect(a).toEqual(b);
    const shifted = { ...parcel.geometry, coordinates: [parcel.geometry.coordinates[0]!.map(([x, y]) => [x! + 0.01, y!])] };
    expect(parcelIdentity('p', shifted, 10).geometryHash).not.toBe(a.geometryHash);
  });

  it('rings are annuli that exclude the parcel', () => {
    const near = ringPolygon(parcel.geometry, plan.controlRule.nearRing);
    const far = ringPolygon(parcel.geometry, plan.controlRule.farRing);
    const parcelHa = polygonAreaHa(parcel.geometry);
    expect(polygonAreaHa(near.geometry)).toBeGreaterThan(50);
    expect(polygonAreaHa(far.geometry)).toBeGreaterThan(polygonAreaHa(near.geometry));
    expect(polygonAreaHa(far.geometry)).toBeGreaterThan(parcelHa * 10);
    const parcelCells = new Set(cellsForPolygon(parcel.geometry, 10));
    for (const c of cellsForPolygon(far.geometry, 10)) expect(parcelCells.has(c)).toBe(false);
  });

  it('point in ring and pixel masks', () => {
    const sq: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    expect(pointInRing(5, 5, sq)).toBe(true);
    expect(pointInRing(15, 5, sq)).toBe(false);
    const grid = { originX: 0, originY: 20, resolution: 2, width: 10, height: 10 };
    const px = pixelMask(grid, [sq]);
    expect(px.length).toBe(25); // 10m x 10m at 2 m pixels
  });

  it('acquisition bbox covers the far ring', () => {
    const [minX, minY, maxX, maxY] = acquisitionBboxUtm(parcel, plan);
    expect(maxX - minX).toBeGreaterThan(2 * plan.controlRule.farRing.outerM);
    expect(maxY - minY).toBeGreaterThan(2 * plan.controlRule.farRing.outerM);
  });
});
