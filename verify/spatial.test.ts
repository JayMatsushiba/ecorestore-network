import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localBackend, verifyWith } from '../verification/engine.js';
import { cellBoundaryLngLat, projectToUtm } from '../verification/geometry.js';
import { buildScenarios, ROOT } from './pipeline.js';
import { spatialBlock } from './spatial.js';

/**
 * The map draws the envelope's `spatial` block. These tests pin three things: the block
 * is derived from the same geometry helpers the engine uses, it agrees with the
 * committed plan, and adding it leaves `resultHash` untouched.
 */
describe('spatial block', async () => {
  const { parcel, list } = buildScenarios();
  const real = list.find((s) => s.name === 'real')!;
  const result = await verifyWith({ projectId: 'kootenay-demo', parcel, plan: real.plan, evidence: real.evidence, runIndex: 1, computedAt: '2026-09-10T00:00:00.000Z' }, localBackend);
  const spatial = spatialBlock(parcel, real.plan, real.evidence, result);

  it('carries the parcel, both rings, the read window and the matched controls', () => {
    expect(spatial.crs).toBe('EPSG:4326');
    expect(spatial.parcel.geometry).toEqual(parcel.geometry);
    expect(spatial.parcel.provenance).toBe('REAL');
    expect(spatial.parcel.areaHa).toBe(result.parcelAreaHa);
    expect(spatial.rings.map((r) => r.ring)).toEqual(['near', 'far']);
    expect(spatial.readWindow.sourceCrs).toBe(real.evidence.tier0.crs);
    expect(spatial.controls.far.matched.map((c) => c.unitId)).toEqual(result.controlSets.find((c) => c.ring === 'far')!.matchedUnitIds);
    expect(spatial.controls.near.matched.map((c) => c.unitId)).toEqual(result.controlSets.find((c) => c.ring === 'near')!.matchedUnitIds);
    expect(spatial.evidencePoints.provenance).toBe('SIMULATED');
    expect(spatial.evidencePoints.tier1Plots.length).toBe(real.evidence.tier1.plots.length);
    expect(spatial.notShown.length).toBeGreaterThan(0);
  });

  it('ring extents agree with the plan radii', () => {
    // The ring bbox extends past the parcel bbox by the outer radius on every side (±2% for buffer discretisation).
    const [px0, py0] = projectToUtm([spatial.parcel.bbox[0], spatial.parcel.bbox[1]]);
    const [px1, py1] = projectToUtm([spatial.parcel.bbox[2], spatial.parcel.bbox[3]]);
    for (const ring of spatial.rings) {
      const planRing = real.plan.controlRule[ring.ring === 'near' ? 'nearRing' : 'farRing'];
      expect(ring.innerM).toBe(planRing.innerM);
      expect(ring.outerM).toBe(planRing.outerM);
      const [rx0, ry0] = projectToUtm([ring.bbox[0], ring.bbox[1]]);
      const [rx1, ry1] = projectToUtm([ring.bbox[2], ring.bbox[3]]);
      for (const pad of [px0 - rx0, py0 - ry0, rx1 - px1, ry1 - py1]) expect(Math.abs(pad - ring.outerM) / ring.outerM).toBeLessThan(0.02);
    }
  });

  it('the read window in WGS84 contains the far ring', () => {
    const [x0, y0, x1, y1] = spatial.readWindow.bboxLngLat;
    const far = spatial.rings.find((r) => r.ring === 'far')!.bbox;
    expect(x0).toBeLessThanOrEqual(far[0]);
    expect(y0).toBeLessThanOrEqual(far[1]);
    expect(x1).toBeGreaterThanOrEqual(far[2]);
    expect(y1).toBeGreaterThanOrEqual(far[3]);
  });

  it('cell boundaries are the ones geometry.ts produces', () => {
    const cell = spatial.controls.far.matched[0]!;
    expect(cell.boundary).toEqual(cellBoundaryLngLat(cell.unitId).map(([x, y]) => [Math.round(x! * 1e6) / 1e6, Math.round(y! * 1e6) / 1e6]));
    expect(cell.boundary.length).toBeGreaterThanOrEqual(7);
    expect(cell.boundary[0]).toEqual(cell.boundary[cell.boundary.length - 1]);
  });

  it('adding the block leaves resultHash unchanged against the committed bundle', () => {
    const committed = JSON.parse(readFileSync(join(ROOT, 'app', 'public', 'demo', 'real', 'assurance-bundle.json'), 'utf8')) as { result: { resultHash: string } };
    expect(result.resultHash).toBe(committed.result.resultHash);
  });
});
