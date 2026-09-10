/**
 * Fixture loaders: the committed REAL Tier 0 snapshot, the pre-registered plan,
 * the parcel record, and deterministically generated SIMULATED Tiers 1-3.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cellsForPolygon } from './geometry.js';
import type { AnalysisPlan, EvidenceBundle, ParcelRecord, Tier0Snapshot } from './models.js';
import { DEFAULT_SIMULATION, simulateTier1, simulateTier2, simulateTier3, type SimulationParams } from './simulate.js';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(here, 'fixtures');

export function loadParcel(): ParcelRecord {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'kootenay-parcel.json'), 'utf8')) as ParcelRecord;
}

export function loadPlan(): AnalysisPlan {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'analysis-plan.json'), 'utf8')) as AnalysisPlan;
}

export function loadTier0(parcelId = 'kootenay-riparian-001'): Tier0Snapshot {
  const snap = JSON.parse(readFileSync(join(FIXTURES_DIR, `tier0-${parcelId}.json`), 'utf8')) as Tier0Snapshot;
  if (snap.provenance !== 'REAL') throw new Error('Tier 0 fixture is not marked REAL');
  return snap;
}

export function simulatedTiers(parcel: ParcelRecord, plan: AnalysisPlan, overrides: Partial<Omit<SimulationParams, 'parcelCells'>> = {}) {
  const params: SimulationParams = {
    ...DEFAULT_SIMULATION,
    ...overrides,
    metricId: overrides.metricId ?? plan.metric.id,
    parcelCells: cellsForPolygon(parcel.geometry, plan.controlRule.parcelCellResolution).sort(),
  };
  return { tier1: simulateTier1(params), tier2: simulateTier2(params), tier3: simulateTier3(params) };
}

export function loadEvidenceBundle(overrides: Partial<Omit<SimulationParams, 'parcelCells'>> = {}): { parcel: ParcelRecord; plan: AnalysisPlan; evidence: EvidenceBundle } {
  const parcel = loadParcel();
  const plan = loadPlan();
  const tier0 = loadTier0(parcel.parcelId);
  return { parcel, plan, evidence: { tier0, ...simulatedTiers(parcel, plan, overrides) } };
}
