/**
 * Spatial identity and sampling geometry (docs/ARCHITECTURE.md §5).
 *
 * H3 is the index and join key. Polygon geometry carries quantities: every
 * hectare figure comes from geodesic polygon area, never from cell counts.
 */
import area from '@turf/area';
import buffer from '@turf/buffer';
import difference from '@turf/difference';
import { featureCollection, polygon as turfPolygon } from '@turf/helpers';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import { cellToBoundary, cellToLatLng, polygonToCells } from 'h3-js';
import proj4 from 'proj4';
import { keccakOf, merkleRoot } from './canonical.js';
import type { Hex, ParcelIdentity, ParcelPolygon, RingGeometry } from './models.js';

export const UTM_11N = '+proj=utm +zone=11 +datum=WGS84 +units=m +no_defs';
export const WGS84 = 'EPSG:4326';

export function projectToUtm(lngLat: Position): [number, number] {
  const [x, y] = proj4(WGS84, UTM_11N, [lngLat[0]!, lngLat[1]!]);
  return [x!, y!];
}

export function unprojectFromUtm(xy: [number, number]): [number, number] {
  const [lng, lat] = proj4(UTM_11N, WGS84, xy);
  return [lng!, lat!];
}

export function geometryHash(geometry: ParcelPolygon): Hex {
  return keccakOf(geometry);
}

export function polygonAreaHa(geometry: Polygon | MultiPolygon): number {
  return area(geometry) / 10_000;
}

/** H3 cells whose centre lies inside the polygon (h3-js v4, GeoJSON ordering). */
export function cellsForPolygon(geometry: Polygon | MultiPolygon, resolution: number): string[] {
  if (geometry.type === 'Polygon') return polygonToCells(geometry.coordinates, resolution, true);
  const out = new Set<string>();
  for (const poly of geometry.coordinates) for (const c of polygonToCells(poly, resolution, true)) out.add(c);
  return [...out];
}

export function parcelIdentity(parcelId: string, geometry: ParcelPolygon, h3Resolution: number): ParcelIdentity {
  const cells = cellsForPolygon(geometry, h3Resolution);
  return {
    parcelId,
    geometryHash: geometryHash(geometry),
    h3Root: merkleRoot(cells),
    h3Resolution,
    h3CellCount: cells.length,
    areaHa: polygonAreaHa(geometry),
  };
}

/** Annulus between innerM and outerM around the parcel. */
export function ringPolygon(parcel: ParcelPolygon, ring: RingGeometry): Feature<Polygon | MultiPolygon> {
  const outer = buffer(parcel, ring.outerM / 1000, { units: 'kilometers' });
  if (!outer) throw new Error('ring buffer failed');
  const innerRadius = ring.innerM > 0 ? ring.innerM / 1000 : 0;
  const inner = innerRadius > 0 ? buffer(parcel, innerRadius, { units: 'kilometers' }) : turfPolygon(parcel.coordinates);
  if (!inner) throw new Error('ring inner buffer failed');
  const diff = difference(featureCollection([outer as Feature<Polygon | MultiPolygon>, inner as Feature<Polygon | MultiPolygon>]));
  if (!diff) throw new Error('ring difference produced no geometry');
  return diff;
}

export function cellBoundaryLngLat(cell: string): Position[] {
  return cellToBoundary(cell, true) as Position[];
}

export function cellCentroidLngLat(cell: string): [number, number] {
  const [lat, lng] = cellToLatLng(cell);
  return [lng, lat];
}

export function cellPolygon(cell: string): Polygon {
  const ring = cellBoundaryLngLat(cell);
  return { type: 'Polygon', coordinates: [ring] };
}

/** Even-odd point-in-polygon on projected coordinates. */
export function pointInRing(x: number, y: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface PixelGrid {
  /** UTM x of the left edge of the first column. */
  originX: number;
  /** UTM y of the top edge of the first row. */
  originY: number;
  resolution: number;
  width: number;
  height: number;
}

/**
 * Indices (row-major) of pixels whose centres fall inside the projected polygon
 * exterior ring and outside any holes.
 */
export function pixelMask(grid: PixelGrid, projectedRings: Array<Array<[number, number]>>): Uint32Array {
  const outer = projectedRings[0]!;
  const holes = projectedRings.slice(1);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outer) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const c0 = Math.max(0, Math.floor((minX - grid.originX) / grid.resolution));
  const c1 = Math.min(grid.width - 1, Math.ceil((maxX - grid.originX) / grid.resolution));
  const r0 = Math.max(0, Math.floor((grid.originY - maxY) / grid.resolution));
  const r1 = Math.min(grid.height - 1, Math.ceil((grid.originY - minY) / grid.resolution));
  const out: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const y = grid.originY - (r + 0.5) * grid.resolution;
    for (let c = c0; c <= c1; c++) {
      const x = grid.originX + (c + 0.5) * grid.resolution;
      if (!pointInRing(x, y, outer)) continue;
      let inHole = false;
      for (const h of holes) if (pointInRing(x, y, h)) { inHole = true; break; }
      if (!inHole) out.push(r * grid.width + c);
    }
  }
  return Uint32Array.from(out);
}

export function projectRings(rings: Position[][]): Array<Array<[number, number]>> {
  return rings.map((ring) => ring.map((p) => projectToUtm(p)));
}

export function bboxOfPolygon(geometry: Polygon | MultiPolygon): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) for (const ring of poly) for (const [x, y] of ring as Array<[number, number]>) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
