/**
 * Sampling frame: the parcel, its sub-parcel cells, and the near/far ring
 * candidate control units, each with a pixel mask on the acquisition grid.
 *
 * Unit geometry is H3 (index / join key). Unit *area* is geodesic polygon area.
 */
import type { MultiPolygon, Polygon, Position } from 'geojson';
import {
  bboxOfPolygon,
  cellCentroidLngLat,
  cellPolygon,
  cellsForPolygon,
  pixelMask,
  polygonAreaHa,
  projectRings,
  projectToUtm,
  ringPolygon,
  type PixelGrid,
} from './geometry.js';
import type { AnalysisPlan, ParcelRecord, SpatialUnit, UnitZone } from './models.js';

export interface FrameUnit extends SpatialUnit {
  pixels: Uint32Array;
}

export interface SamplingFrame {
  bboxUtm: [number, number, number, number];
  units: FrameUnit[];
}

/** UTM bbox of the parcel expanded to cover the far ring plus a margin. */
export function acquisitionBboxUtm(parcel: ParcelRecord, plan: AnalysisPlan, marginM = 100): [number, number, number, number] {
  const [minLng, minLat, maxLng, maxLat] = bboxOfPolygon(parcel.geometry);
  const corners: Position[] = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
  ].map((c) => projectToUtm(c));
  const xs = corners.map((c) => c[0]!);
  const ys = corners.map((c) => c[1]!);
  const pad = plan.controlRule.farRing.outerM + marginM;
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

function maskOfGeometry(grid: PixelGrid, geometry: Polygon | MultiPolygon): Uint32Array {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const acc = new Set<number>();
  for (const poly of polys) for (const idx of pixelMask(grid, projectRings(poly))) acc.add(idx);
  return Uint32Array.from([...acc].sort((a, b) => a - b));
}

function intersect(a: Uint32Array, b: Set<number>): Uint32Array {
  const out: number[] = [];
  for (const v of a) if (b.has(v)) out.push(v);
  return Uint32Array.from(out);
}

export function buildSamplingFrame(parcel: ParcelRecord, plan: AnalysisPlan, grid: PixelGrid): SamplingFrame {
  const units: FrameUnit[] = [];
  const parcelGeom = parcel.geometry as Polygon;
  const parcelPixels = maskOfGeometry(grid, parcelGeom);
  const parcelSet = new Set(parcelPixels);
  const centroid = cellCentroidLngLat(cellsForPolygon(parcelGeom, plan.controlRule.unitResolution)[0] ?? '');
  units.push({
    unitId: 'parcel',
    zone: 'parcel',
    areaHa: polygonAreaHa(parcelGeom),
    pixelCount: parcelPixels.length,
    centroid,
    pixels: parcelPixels,
  });

  for (const cell of cellsForPolygon(parcelGeom, plan.controlRule.parcelCellResolution).sort()) {
    const geom = cellPolygon(cell);
    const px = intersect(maskOfGeometry(grid, geom), parcelSet);
    if (px.length === 0) continue;
    units.push(unitFor(cell, 'parcel_cell', geom, px));
  }

  const rings: Array<[UnitZone, Polygon | MultiPolygon]> = [
    ['near', ringPolygon(parcel.geometry, plan.controlRule.nearRing).geometry],
    ['far', ringPolygon(parcel.geometry, plan.controlRule.farRing).geometry],
  ];
  for (const [zone, geom] of rings) {
    const ringSet = new Set(maskOfGeometry(grid, geom));
    for (const cell of cellsForPolygon(geom, plan.controlRule.unitResolution).sort()) {
      const cellGeom = cellPolygon(cell);
      const px = intersect(maskOfGeometry(grid, cellGeom), ringSet);
      if (px.length === 0) continue;
      units.push(unitFor(cell, zone, cellGeom, px));
    }
  }
  return { bboxUtm: [grid.originX, grid.originY - grid.height * grid.resolution, grid.originX + grid.width * grid.resolution, grid.originY], units };
}

function unitFor(cell: string, zone: UnitZone, geom: Polygon, px: Uint32Array): FrameUnit {
  return {
    unitId: cell,
    zone,
    areaHa: polygonAreaHa(geom),
    pixelCount: px.length,
    centroid: cellCentroidLngLat(cell),
    pixels: px,
  };
}
