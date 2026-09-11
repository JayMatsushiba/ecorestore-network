/**
 * Spatial block of the assurance bundle envelope: the geometry the map view draws.
 *
 * This block sits on the envelope, never on `VerificationResult`. `resultHash` is
 * keccak256 over the result, and the deed cites that hash, so widening the result for a
 * presentation feature would change what settles on chain. Nothing here is recomputed:
 * every polygon comes from the same helpers the engine used (`verification/geometry.ts`),
 * and the matched cell ids are the ones the result already cites.
 */
import type { MultiPolygon, Polygon, Position } from 'geojson';
import { bboxOfPolygon, cellBoundaryLngLat, cellCentroidLngLat, ringPolygon, unprojectFromUtm } from '../verification/geometry.js';
import type { AnalysisPlan, EvidenceBundle, ParcelRecord, Provenance, VerificationResult } from '../verification/models.js';

export interface SpatialCell {
  unitId: string;
  /** Closed GeoJSON ring, [lng, lat], WGS84. */
  boundary: Position[];
}

export interface SpatialPoint {
  id: string;
  /** Centroid of the record's H3 cell, [lng, lat], WGS84. */
  lngLat: [number, number];
  label: string;
}

export interface SpatialBlock {
  crs: 'EPSG:4326';
  /** Real ground; the deed, the intervention and its date are constructed. */
  parcel: {
    parcelId: string;
    name: string;
    locationNote: string;
    geometry: ParcelRecord['geometry'];
    areaHa: number;
    centroid: [number, number];
    bbox: [number, number, number, number];
    provenance: 'REAL';
  };
  /** Control rings, drawn from the committed plan around the parcel. */
  rings: Array<{ ring: 'near' | 'far'; innerM: number; outerM: number; geometry: Polygon | MultiPolygon; bbox: [number, number, number, number] }>;
  /** The pixel window the pipeline actually read, in its source CRS and in WGS84. */
  readWindow: {
    sourceCrs: string;
    bbox: [number, number, number, number];
    pixelWindow: [number, number, number, number];
    grid?: { originX: number; originY: number; resolution: number; width: number; height: number };
    bboxLngLat: [number, number, number, number];
    provenance: Provenance;
  };
  /** Matched control cells at the plan's unit resolution; ids are those the result cites. */
  controls: {
    resolution: number;
    far: { candidates: number; matched: SpatialCell[] };
    near: { candidates: number; matched: SpatialCell[] };
    provenance: Provenance;
  };
  /** Tier 1–3 evidence locations. Simulated: the cells were drawn for the demonstration. */
  evidencePoints: { provenance: 'SIMULATED'; tier1Plots: SpatialPoint[]; tier2Nodes: SpatialPoint[]; tier3Photos: SpatialPoint[] };
  /** Per-cell gate values are not serialised; the map must say so rather than imply them. */
  notShown: string[];
}

/** Six decimals of a degree is about 11 cm: finer than a 10 m pixel, and a third of the bytes. */
function r6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function roundRing(ring: Position[]): Position[] {
  return ring.map(([x, y]) => [r6(x!), r6(y!)]);
}

function roundGeometry<G extends Polygon | MultiPolygon>(g: G): G {
  return g.type === 'Polygon' ? ({ ...g, coordinates: g.coordinates.map(roundRing) } as G) : ({ ...g, coordinates: g.coordinates.map((poly) => poly.map(roundRing)) } as G);
}

function roundBbox(b: [number, number, number, number]): [number, number, number, number] {
  return [r6(b[0]), r6(b[1]), r6(b[2]), r6(b[3])];
}

function centroidOf(bbox: [number, number, number, number]): [number, number] {
  return [r6((bbox[0] + bbox[2]) / 2), r6((bbox[1] + bbox[3]) / 2)];
}

function cells(ids: string[]): SpatialCell[] {
  return ids.map((unitId) => ({ unitId, boundary: roundRing(cellBoundaryLngLat(unitId)) }));
}

function points<T>(records: T[], id: (r: T) => string, cell: (r: T) => string, label: (r: T) => string): SpatialPoint[] {
  return records.map((r) => {
    const [lng, lat] = cellCentroidLngLat(cell(r));
    return { id: id(r), lngLat: [r6(lng), r6(lat)], label: label(r) };
  });
}

export function spatialBlock(parcel: ParcelRecord, plan: AnalysisPlan, evidence: EvidenceBundle, result: VerificationResult): SpatialBlock {
  const t0 = evidence.tier0;
  const parcelBbox = bboxOfPolygon(parcel.geometry);
  const rings = (['near', 'far'] as const).map((ring) => {
    const geometry = plan.controlRule[ring === 'near' ? 'nearRing' : 'farRing'];
    const feature = ringPolygon(parcel.geometry, geometry);
    return { ring, innerM: geometry.innerM, outerM: geometry.outerM, geometry: roundGeometry(feature.geometry), bbox: roundBbox(bboxOfPolygon(feature.geometry)) };
  });
  const [minX, minY, maxX, maxY] = t0.window.bbox;
  const sw = unprojectFromUtm([minX, minY]);
  const ne = unprojectFromUtm([maxX, maxY]);
  const control = (ring: 'near' | 'far') => {
    const set = result.controlSets.find((c) => c.ring === ring);
    return { candidates: set?.candidates ?? 0, matched: cells(set?.matchedUnitIds ?? []) };
  };
  return {
    crs: 'EPSG:4326',
    parcel: {
      parcelId: parcel.parcelId,
      name: parcel.name,
      locationNote: parcel.locationNote,
      geometry: parcel.geometry,
      areaHa: result.parcelAreaHa,
      centroid: centroidOf(parcelBbox),
      bbox: roundBbox(parcelBbox),
      provenance: 'REAL',
    },
    rings,
    readWindow: {
      sourceCrs: t0.crs,
      bbox: t0.window.bbox,
      pixelWindow: t0.window.pixelWindow,
      ...(t0.window.grid ? { grid: t0.window.grid } : {}),
      bboxLngLat: roundBbox([sw[0], sw[1], ne[0], ne[1]]),
      provenance: t0.provenance,
    },
    controls: { resolution: plan.controlRule.unitResolution, far: control('far'), near: control('near'), provenance: t0.provenance },
    evidencePoints: {
      provenance: 'SIMULATED',
      tier1Plots: points(evidence.tier1.plots, (p) => p.plotId, (p) => p.h3Cell, (p) => `drone plot ${p.plotId}`),
      tier2Nodes: points(evidence.tier2.nodes, (n) => n.nodeId, (n) => n.h3Cell, (n) => `soil-moisture node ${n.nodeId}${n.flatlined ? ' (flatlined, excluded)' : ''}`),
      tier3Photos: points(evidence.tier3.geotaggedPhotos, (p) => p.photoId, (p) => p.h3Cell, (p) => `geotagged photo ${p.photoId}, ${p.date}`),
    },
    notShown: [
      'no_net_habitat_loss decides per parcel sub-cell; per-cell values are not serialised, so the map does not show them',
      'per-scene pixel masks are not serialised; the read window is the extent shared by every scene',
    ],
  };
}
