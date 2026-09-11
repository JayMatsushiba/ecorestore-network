/** Subset of the demo assurance bundle the presentation layer reads. Presentation only: nothing here is recomputed. */

export type Provenance = 'REAL' | 'SIMULATED';

/** Mirrors `VerificationStatus` in `verification/models.ts`. */
export type VerificationStatus = 'VERIFIED' | 'PARTIAL' | 'NOT_ADDITIONAL' | 'INSUFFICIENT_EVIDENCE' | 'GATE_FAILED' | 'INVALID_RESULT';

export interface Gate {
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_EVALUATED';
  detail: string;
  provenance: Provenance;
}

export interface VerificationResult {
  parcelId: string;
  parcelAreaHa: number;
  analysisPlanHash: string;
  runIndex: number;
  methodologyVersion: string;
  processingGraphVersion: string;
  /** Which implementation of the analysis boundary produced the numbers. */
  analysisEngine: { name: string; version: string };
  stacSceneIds: string[];
  tier0Provenance: { provenance: Provenance; catalog: string; collection: string; snapshotHash: string; note?: string };
  metric: { id: string; version: string; unit: string };
  window: { start: string; end: string };
  claimedQuantity: number;
  measured: {
    parcelChangeHa: number;
    controlChangeFarRingHa: number;
    controlChangeNearRingHa: number;
    leakageHa: number;
    additionalBiophysicalHa: number;
  };
  controlSets: Array<{ ring: 'near' | 'far'; geometry: { innerM: number; outerM: number }; candidates: number; matched: number; matchedUnitIds: string[] }>;
  /** `criterion` is the threshold the committed plan set. A verdict without it cannot be read. */
  parallelTrend: { status: string; slopeDiffPerYear: number | null; pValue: number | null; nObservations: number; criterion: string };
  uncertainty: {
    interval: { lower: number; upper: number; confidenceLevel: number };
    empiricalCoverage: { nominal: number; empirical: number | null; placebos: number; basis: string };
  };
  lowerBound: number;
  qualityGate: { status: string; gates: Gate[] };
  tierCorroboration: Array<{ tier: number; label: string; provenance: Provenance; score: number; note?: string }>;
  obligationStatus: string;
  verificationStatus: VerificationStatus;
  statusReason: string;
  settledQuantity: number;
  settlementBasis: string;
  evidenceCid: string;
  resultHash: string;
  simulatedTiersBanner: string;
}

export interface TrajectoryPoint {
  sceneId: string;
  date: string;
  parcel: number | null;
  far: { mean: number; sd: number; n: number } | null;
  near: { mean: number; sd: number; n: number } | null;
}

/** [lng, lat] in WGS84. */
export type LngLat = [number, number];
export type Bbox = [number, number, number, number];
export type PolygonGeometry = { type: 'Polygon'; coordinates: LngLat[][] } | { type: 'MultiPolygon'; coordinates: LngLat[][][] };

export interface SpatialCell {
  unitId: string;
  boundary: LngLat[];
}

export interface SpatialPoint {
  id: string;
  lngLat: LngLat;
  label: string;
}

/**
 * Geometry the map draws. Mirrors `verify/spatial.ts`. It lives on the bundle envelope,
 * never on the hashed result, and every coordinate comes from the engine's own helpers.
 */
export interface SpatialBlock {
  crs: 'EPSG:4326';
  parcel: { parcelId: string; name: string; locationNote: string; geometry: PolygonGeometry; areaHa: number; centroid: LngLat; bbox: Bbox; provenance: 'REAL' };
  rings: Array<{ ring: 'near' | 'far'; innerM: number; outerM: number; geometry: PolygonGeometry; bbox: Bbox }>;
  readWindow: { sourceCrs: string; bbox: Bbox; pixelWindow: Bbox; grid?: { originX: number; originY: number; resolution: number; width: number; height: number }; bboxLngLat: Bbox; provenance: Provenance };
  controls: { resolution: number; far: { candidates: number; matched: SpatialCell[] }; near: { candidates: number; matched: SpatialCell[] }; provenance: Provenance };
  evidencePoints: { provenance: 'SIMULATED'; tier1Plots: SpatialPoint[]; tier2Nodes: SpatialPoint[]; tier3Photos: SpatialPoint[] };
  notShown: string[];
}

export type ScenarioId = 'real' | 'synthetic' | 'trend-failure';

export interface AssuranceBundle {
  scenario: ScenarioId;
  description: string;
  tier0Provenance: VerificationResult['tier0Provenance'];
  simulatedTiersBanner: string;
  assuranceAdjustedComparison: string;
  trajectory: { points: TrajectoryPoint[] };
  result: VerificationResult;
  verdictCredential: { issuer: string; issuanceDate: string; proof?: { type: string } };
  credentialCheck: { signatureValid: boolean; schemaValid: boolean; resultHashMatches: boolean | null };
  presentation: { presentationHash: string; guardian: { stoodUp: boolean; note: string } };
  guardianSubmission: { request: { method: string; path: string; url: string | null }; outcome: { mode: 'sent' | 'outbox' | 'failed'; detail: string; httpStatus?: number } };
  issuance: { broadcast?: false; partition?: string; valueHa?: number; document?: { uri: string; documentHash: string }; prepared?: false; reason?: string };
  contract: {
    broadcast: boolean;
    chain: { deedId: string; runIndex: number; milestoneState: string; balances: Record<string, string>; txs: Array<{ step: string; hash: string }> } | null;
    verifyMilestone: { calldata: string; status: number; lowerBoundQuantity: string };
  };
  auditorReport: { narrative: string; anomalies: Array<{ code: string; severity: string; detail: string }>; boundary: { llmUsed: boolean } };
  /** Absent on bundles produced before the map view existed. */
  spatial?: SpatialBlock;
  /** Present on bundles produced by the verify service; absent on older committed bundles. */
  runtime?: { analysisEngine: { name: string; version: string }; computedAt: string };
}

/** Where the bundle on screen came from. */
export type BundleSource =
  | { kind: 'live'; elapsedMs: number }
  | { kind: 'static'; reason: string };
