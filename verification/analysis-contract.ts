/**
 * The verify ⇄ analysis boundary (docs/DEPLOYMENT.md §7).
 *
 * Everything upstream of canonicalisation — control drawing, the parallel-trend
 * diagnostic, DiD, leakage, the bootstrap and placebo coverage — is *analysis*.
 * It returns numbers. It returns no hashes it computed, no canonical documents
 * and no signed material.
 *
 * Inputs cross the boundary as raw canonical bytes with a hash receipt. The
 * analysis side verifies a receipt by hashing the opaque string it was handed;
 * it never re-serialises. Exactly one implementation (`canonical.ts`) turns a
 * document into bytes.
 *
 * Two backends implement this contract: the reference TypeScript engine in
 * `engine.ts` and the Python service in `analysis/`. Given identical inputs
 * they must produce identical output — `analysis/tests/` checks that against
 * fixtures dumped from the TypeScript side.
 */
import type { ControlSetSummary, GateStatus, Hex } from './models.js';

export interface AnalysisEngineId {
  name: string;
  version: string;
}

export interface AnalysisRequest {
  /** `canonicalize(plan)` — the exact bytes whose keccak is `planHash`. */
  planCanonical: string;
  planHash: Hex;
  /** `canonicalize(snapshot without its snapshotHash field)` — the bytes whose keccak is `snapshotHash`. */
  tier0Canonical: string;
  snapshotHash: Hex;
}

export interface ParcelSummary {
  unitId: string;
  areaHa: number;
  preLevel: number | null;
  preSlope: number | null;
  postComposite: number | null;
  /** post − pre-level, or null when either is missing. */
  changeIndex: number | null;
}

export interface ParcelCellsSummary {
  /** Sub-parcel cells with both a pre-level and a post composite. */
  count: number;
  areaHa: number;
  /** Area fraction of those cells whose ΔNDVI fell below the plan's drop threshold; 1 when there are no cells. */
  lossCellFraction: number;
}

export interface ParallelTrendSummary {
  status: GateStatus;
  slopeDiffPerYear: number | null;
  pValue: number | null;
  nObservations: number;
  criterion: string;
}

export interface EstimateSummary {
  parcelChange: number;
  farChange: number;
  nearChange: number;
  leakage: number;
  did: number;
  additional: number;
}

export interface AnalysisOutput {
  engine: AnalysisEngineId;
  /** Receipts echoed back so verify can assert it got the analysis of what it sent. */
  planHash: Hex;
  snapshotHash: Hex;
  parcel: ParcelSummary;
  parcelCells: ParcelCellsSummary;
  /** Scene IDs inside the plan's windows under the cloud threshold, sorted. */
  stacSceneIds: string[];
  /** Usable scenes (parcel NDVI present) per plan window, in plan order. */
  scenesPerWindow: Array<{ label: string; usable: number }>;
  controlSets: ControlSetSummary[];
  parallelTrend: ParallelTrendSummary;
  /** null when the estimator is not computable (insufficient controls or no parcel change). */
  estimate: EstimateSummary | null;
  /** Bootstrap interval in hectares, already rounded to 4 dp; null when there is no estimate. */
  interval: { lower: number; upper: number } | null;
  coverage: { empirical: number | null; placebos: number };
  tier0Usable: { usableScenes: number; totalScenes: number };
}

export interface AnalysisBackend {
  readonly engine: AnalysisEngineId;
  analyse(req: AnalysisRequest): Promise<AnalysisOutput>;
}
