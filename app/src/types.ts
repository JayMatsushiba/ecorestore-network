/** Subset of the demo assurance bundle the presentation layer reads. Presentation only: nothing here is recomputed. */

export type Provenance = 'REAL' | 'SIMULATED';

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
  controlSets: Array<{ ring: 'near' | 'far'; geometry: { innerM: number; outerM: number }; candidates: number; matched: number }>;
  parallelTrend: { status: string; slopeDiffPerYear: number; pValue: number; nObservations: number };
  uncertainty: {
    interval: { lower: number; upper: number; confidenceLevel: number };
    empiricalCoverage: { nominal: number; empirical: number | null; placebos: number; basis: string };
  };
  lowerBound: number;
  qualityGate: { status: string; gates: Gate[] };
  tierCorroboration: Array<{ tier: number; label: string; provenance: Provenance; score: number; note?: string }>;
  obligationStatus: string;
  verificationStatus: string;
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

export interface AssuranceBundle {
  scenario: 'real' | 'synthetic' | 'trend-failure';
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
  /** Present on bundles produced by the verify service; absent on older committed bundles. */
  runtime?: { analysisEngine: { name: string; version: string }; computedAt: string };
}

/** Where the bundle on screen came from. */
export type BundleSource =
  | { kind: 'live'; elapsedMs: number }
  | { kind: 'static'; reason: string };
