/**
 * SIMULATED Tier 1-3 evidence generators.
 *
 * Everything produced here is SIMULATED DEMONSTRATION DATA — NOT REAL FIELD,
 * SENSOR OR REGULATORY MEASUREMENT. The generators are seeded and
 * deterministic so the pipeline is reproducible; they are parameterised by
 * realistic values, not by the real Tier 0 outcome, so simulated tiers never
 * "confirm" the satellite result by construction.
 */
import { keccakOf } from './canonical.js';
import { makeRng, randomNormal } from './stats.js';
import {
  SIMULATED_BANNER,
  type IsoDate,
  type ObservationWindow,
  type Tier1DroneEvidence,
  type Tier2IotEvidence,
  type Tier3GroundEvidence,
} from './models.js';

export interface SimulationParams {
  seed: number;
  /** H3 cells inside the parcel available to place plots, nodes and photos. */
  parcelCells: string[];
  claimWindow: ObservationWindow;
  claimedHa: number;
  metricId: string;
  nativeSpeciesFraction: number;
  plotCount: number;
  nodeCount: number;
  /** Index of the IoT node that flatlines through recorded rainfall (or -1). */
  flatlinedNodeIndex: number;
}

export const DEFAULT_SIMULATION: Omit<SimulationParams, 'parcelCells'> = {
  seed: 424242,
  claimWindow: { label: 'claim-2025', start: '2024-10-15', end: '2025-09-30' },
  claimedHa: 42,
  metricId: 'riparian_woody_cover_gain_ha',
  nativeSpeciesFraction: 0.86,
  plotCount: 12,
  nodeCount: 4,
  flatlinedNodeIndex: 2,
};

const GENERATOR = { name: 'ecorestore-simulated-tiers', version: '1.0.0' };

function withHash<T extends { bundleHash?: unknown }>(doc: Omit<T, 'bundleHash'>): T {
  return { ...(doc as object), bundleHash: keccakOf(doc) } as T;
}

export function simulateTier1(p: SimulationParams): Tier1DroneEvidence {
  const rng = makeRng(p.seed ^ 0x1111);
  const plots = Array.from({ length: p.plotCount }, (_, i) => {
    const pre = clamp(randomNormal(rng, 0.18, 0.06), 0.02, 0.6);
    const gain = clamp(randomNormal(rng, 0.22, 0.08), 0, 0.6);
    const stems = Math.max(5, Math.round(randomNormal(rng, 140, 30)));
    const native = Math.round(stems * clamp(randomNormal(rng, p.nativeSpeciesFraction, 0.05), 0.5, 1));
    return {
      plotId: `plot-${String(i + 1).padStart(2, '0')}`,
      h3Cell: p.parcelCells[Math.floor(rng() * p.parcelCells.length)] ?? '',
      canopyFractionPre: round3(pre),
      canopyFractionPost: round3(clamp(pre + gain, 0, 1)),
      stemsDetected: stems,
      nativeStems: native,
    };
  });
  const totalStems = plots.reduce((s, x) => s + x.stemsDetected, 0);
  const totalNative = plots.reduce((s, x) => s + x.nativeStems, 0);
  return withHash<Tier1DroneEvidence>({
    provenance: 'SIMULATED',
    banner: SIMULATED_BANNER,
    generator: { ...GENERATOR, seed: p.seed },
    tier: 1,
    surveyDate: '2025-08-20',
    orthomosaicRef: 'simulated://orthomosaic/kootenay-2025-08-20 (no file exists)',
    plots,
    nativeSpeciesFraction: round3(totalNative / totalStems),
  });
}

export function simulateTier2(p: SimulationParams): Tier2IotEvidence {
  const rng = makeRng(p.seed ^ 0x2222);
  const dates = weekly('2025-04-01', 30);
  const rainfallEvents: IsoDate[] = [dates[5]!, dates[12]!, dates[20]!, dates[26]!];
  const rainSet = new Set(rainfallEvents);
  const nodes = Array.from({ length: p.nodeCount }, (_, i) => {
    const flat = i === p.flatlinedNodeIndex;
    let level = 0.22 + rng() * 0.05;
    const series = dates.map((date) => {
      if (flat) return { date, value: 0.241 };
      if (rainSet.has(date)) level = clamp(level + 0.08 + rng() * 0.04, 0.05, 0.5);
      else level = clamp(level - 0.012 + randomNormal(rng, 0, 0.006), 0.05, 0.5);
      return { date, value: round3(level) };
    });
    return { nodeId: `node-${i + 1}`, h3Cell: p.parcelCells[Math.floor(rng() * p.parcelCells.length)] ?? '', metric: 'soil_moisture_vwc' as const, series, flatlined: flat };
  });
  return withHash<Tier2IotEvidence>({
    provenance: 'SIMULATED',
    banner: SIMULATED_BANNER,
    generator: { ...GENERATOR, seed: p.seed },
    tier: 2,
    nodes,
    rainfallEvents,
  });
}

export function simulateTier3(p: SimulationParams): Tier3GroundEvidence {
  const rng = makeRng(p.seed ^ 0x3333);
  const species = [
    { name: 'Populus balsamifera ssp. trichocarpa (black cottonwood)', native: true },
    { name: 'Salix lucida (Pacific willow)', native: true },
    { name: 'Cornus sericea (red-osier dogwood)', native: true },
    { name: 'Alnus incana (mountain alder)', native: true },
    { name: 'Salix × sepulcralis (weeping willow, ornamental)', native: false },
  ];
  const plantingRecords = ['2024-10-18', '2024-10-22', '2024-10-29', '2025-04-14', '2025-04-21'].map((date) => {
    const sp = species[Math.floor(rng() * species.length)]!;
    return { date, species: sp.name, stems: 400 + Math.floor(rng() * 900), native: sp.native };
  });
  const geotaggedPhotos = Array.from({ length: 9 }, (_, i) => ({
    photoId: `photo-${String(i + 1).padStart(3, '0')}`,
    h3Cell: p.parcelCells[Math.floor(rng() * p.parcelCells.length)] ?? '',
    date: i < 5 ? '2024-10-29' : '2025-08-18',
  }));
  return withHash<Tier3GroundEvidence>({
    provenance: 'SIMULATED',
    banner: SIMULATED_BANNER,
    generator: { ...GENERATOR, seed: p.seed },
    tier: 3,
    claim: { metricId: p.metricId, value: p.claimedHa, unit: 'ha', window: p.claimWindow, submittedBy: 'did:key:z6MkSimulatedRestorerForDemonstrationOnly' },
    plantingRecords,
    geotaggedPhotos,
  });
}

function weekly(start: IsoDate, n: number): IsoDate[] {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(t0 + i * 7 * 86_400_000).toISOString().slice(0, 10));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
