/**
 * Ecorestore Network — M6 UI response types
 *
 * These mirror server/index.ts's JSON responses, which are themselves the
 * real M1-M5 objects (verification/models.ts's VerificationResult,
 * guardian/models.ts's GuardianCredential, graph/types.ts's DeedHistory,
 * auditor/agent.ts's AuditReport) serialized as-is. Kept as a local,
 * self-contained copy rather than importing across the app/<->root
 * TypeScript project boundary (app/ is its own Vite/React project, same
 * isolation principle as subgraph/ — see docs/GRAPH.md). If a field here
 * ever drifts from the real type it mirrors, that is a bug to fix, not a
 * license to invent a new field.
 */

export interface ParcelCharacteristics {
  landCover: string;
  elevationMeters: number;
  slopeDegrees: number;
  aspect: string;
  soilType: string;
  climateZone: string;
}

export interface Parcel {
  parcelId: string;
  role: "treated" | "control_candidate";
  areaHectares: number;
  characteristics: ParcelCharacteristics;
  contaminationReason?: string;
}

export interface ObservationWindow {
  preTreatmentStart: string;
  preTreatmentEnd: string;
  postTreatmentStart: string;
  postTreatmentEnd: string;
}

export interface EvidenceObservation {
  evidenceId: string;
  parcelId: string;
  metric: string;
  period: "pre_treatment" | "post_treatment";
  value: number;
  observedAt: string;
  source: string;
  synthetic: true;
}

export interface ProjectResponse {
  fixtureKey: string;
  disclaimer: string;
  metric: string;
  methodologyVersion: string;
  project: {
    projectId: string;
    name: string;
    location: string;
    claimedQuantity: number;
    window: ObservationWindow;
    treatedParcel: Parcel;
    candidateControlParcels: Parcel[];
  };
}

export interface EvidenceResponse {
  fixtureKey: string;
  disclaimer: string;
  metric: string;
  evidence: EvidenceObservation[];
}

/**
 * Mirrors server/spatialFixtures.ts. Synthetic demonstration geometry for
 * the Overview map — drawn for this prototype, never read by the M1 engine.
 */
export interface ParcelFeatureProperties {
  parcelId: string;
  role: "treated" | "control_candidate";
  areaHectares: number;
  landCover: string;
  contaminationReason?: string;
  synthetic: true;
}

export interface ParcelFeature {
  type: "Feature";
  id: string;
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
  properties: ParcelFeatureProperties;
}

export interface ParcelFeatureCollection {
  type: "FeatureCollection";
  features: ParcelFeature[];
}

export interface GeometryResponse {
  fixtureKey: string;
  disclaimer: string;
  projectId: string;
  treatedParcelId: string;
  parcelsWithoutGeometry: string[];
  extent: ParcelFeatureCollection;
}

export interface Uncertainty {
  model: string;
  confidenceLevel: number;
  pointEstimate: number;
  lowerBound: number;
  upperBound: number;
  status: string;
}

export interface VerificationDiagnostics {
  treatedParcelId: string;
  eligibleControlParcelIds: string[];
  excludedContaminatedControls: { parcelId: string; reason: string }[];
  excludedNonMatchingControlParcelIds: string[];
  treatedPreTreatmentLevel: number;
  treatedPostTreatmentLevel: number;
  treatedObservedChange: number;
  controlPreTreatmentLevel: number;
  controlPostTreatmentLevel: number;
  controlObservedChange: number;
  treatedPreTreatmentSlopePerYear: number | null;
  controlMeanPreTreatmentSlopePerYear: number | null;
  parallelTrendDivergenceRatio: number | null;
}

export interface VerificationResult {
  projectId: string;
  parcelH3Root: string;
  methodologyVersion: string;
  metric: string;
  claimedQuantity: number;
  observedChange: number;
  controlChange: number;
  additionalityAdjusted: number;
  uncertainty: Uncertainty;
  lowerBound: number;
  settledQuantity: number;
  parallelTrendStatus: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";
  qualityGateStatus: "PASS" | "INSUFFICIENT_EVIDENCE" | "INVALID_RESULT";
  verificationStatus: "VERIFIED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE" | "INVALID_RESULT";
  evidenceHash: string;
  window: ObservationWindow;
  diagnostics: VerificationDiagnostics;
}

export interface VerificationResponse {
  fixtureKey: string;
  verificationResult: VerificationResult;
}

export interface GuardianCredential {
  credentialId: string;
  submissionId: string;
  verificationResultId: string;
  projectId: string;
  parcelH3Root: string;
  methodologyVersion: string;
  guardianPolicyVersion: string;
  verifierId: string;
  settledQuantity: number;
  issuedAt: string;
}

export interface GuardianResponse {
  fixtureKey: string;
  real: string;
  mock: string;
  verificationResult: VerificationResult;
  guardian: {
    submission: { accepted: boolean; reason?: string };
    authorization: { accepted: boolean; reason?: string } | null;
    credential: GuardianCredential | null;
    lifecycleState: string;
    guardianPolicyVersion?: string;
  };
}

export interface IndexedDeed {
  id: string;
  deedId: string;
  projectId: string;
  parcelH3Root: string;
  sponsor: string;
  beneficiary: string;
  authorizedVerifier: string;
  escrowAmount: string;
  unitPriceUSDC: string;
  quantityDecimals: number;
  fundedAmount: string;
  verificationId: string | null;
  settledQuantityScaled: string | null;
  settlementAmount: string | null;
  releasedAmount: string | null;
  status: "CREATED" | "FUNDED" | "VERIFIED" | "SETTLED" | "FAILED" | "CANCELLED" | "REFUNDED";
  createdAt: string;
  createdBlock: string;
  createdTxHash: string;
  updatedAt: string;
  updatedBlock: string;
  updatedTxHash: string;
}

export interface IndexedEventBase {
  id: string;
  timestamp: string;
  blockNumber: string;
  transactionHash: string;
}

export interface IndexedVerificationEvent extends IndexedEventBase {
  verificationId: string;
  financiallyEligible: boolean;
  settledQuantityScaled: string;
  settlementAmount: string;
}

export interface IndexedSettlementEvent extends IndexedEventBase {
  verificationId: string;
  beneficiary: string;
  settlementAmount: string;
  refundedRemainder: string;
}

export interface IndexedFundingEvent extends IndexedEventBase {
  sponsor: string;
  amount: string;
}

export interface IndexedRefundEvent extends IndexedEventBase {
  sponsor: string;
  amount: string;
}

export interface DeedHistory {
  deed: IndexedDeed;
  verifications: IndexedVerificationEvent[];
  settlements: IndexedSettlementEvent[];
  fundings: IndexedFundingEvent[];
  refunds: IndexedRefundEvent[];
  cancellations: IndexedEventBase[];
}

export type DeedResponse =
  | { status: "OK"; deployment: { deedId: string; settledQuantity: number }; history: DeedHistory }
  | { status: "NOT_FOUND"; reason: string }
  | { status: "UNAVAILABLE"; reason: string };

export interface Anomaly {
  code: string;
  message: string;
}

export interface AuditResponse {
  fixtureKey: string;
  status: "CONSISTENT" | "ANOMALOUS" | "NOT_FOUND" | "DATA_UNAVAILABLE";
  deedId?: string;
  history: DeedHistory | null;
  anomalies: Anomaly[];
  explanation: string;
}

export interface ArcPayloadResponse {
  fixtureKey: string;
  eligible: boolean;
  reason?: string;
  deedIdentity?: { projectId: string; parcelH3Root: string; methodologyVersion: string };
  onChainAuthorization?: {
    verificationId: string;
    projectId: string;
    parcelH3Root: string;
    methodologyVersion: string;
    evidenceHash: string;
    settledQuantityScaled: string;
    financiallyEligible: boolean;
  };
}
